const JobManager = artifacts.require('./TestJobManager.sol');
const {assertFail, blockMiner, roundManagerHelper} = require('../utils.js');
require('truffle-test-utils').init();

contract('JobManager', (accounts) => {
  let jm;
  let contractAddress;

  const MINERAL_COMPUTE = 0;
  const MINERAL_STORAGE = 1;

  const provider1 = accounts[1];
  const provider2 = accounts[2];
  const provider3 = accounts[3];
  const nullAddress = 0;
  const consumer = accounts[9];

  const provider1Stake = 1;
  const provider2Stake = 10;
  const provider3Stake = 30;

  async function approveBondProvider(pricePerStorageMineral, pricePerComputeMineral, blockRewardCut, feeShare, amountBonded, provider) {
    await jm.approve(contractAddress, amountBonded, {from: provider});
    await jm.bond(provider, amountBonded, {from: provider});
    await jm.provider(pricePerStorageMineral, pricePerComputeMineral, blockRewardCut, feeShare, {from: provider});
  }

  async function initNew() {
    jm = await JobManager.new();
    contractAddress = jm.address;
    for (let i = 0; i < 10; i++) {
      await jm.mint(accounts[i], 10000, {from: accounts[0]});
    }
    const electionPeriodEndBlock = await roundManagerHelper.getElectionPeriodEndBlock(jm);
    await blockMiner.mineUntilBlock(electionPeriodEndBlock);
    await jm.initializeRound();
    await jm.setNumberOfActiveProviders(4);
    const pricePerStorageMineral = 22;
    const provider1PricePerComputeMineral = 10;
    const provider2PricePerComputeMineral = 12;
    const provider3PricePerComputeMineral = 14;
    const blockRewardCut = 1;
    const feeShare = 25;
    await approveBondProvider(pricePerStorageMineral, provider1PricePerComputeMineral,
      blockRewardCut, feeShare, provider1Stake, provider1);
    await approveBondProvider(pricePerStorageMineral, provider2PricePerComputeMineral,
      blockRewardCut, feeShare, provider2Stake, provider2);
    await approveBondProvider(pricePerStorageMineral, provider3PricePerComputeMineral,
      blockRewardCut, feeShare, provider3Stake, provider3);
  }

  async function initializeNewRound() {
    const newRoundBlock = await roundManagerHelper.getElectionPeriodEndBlock(jm);
    await blockMiner.mineUntilBlock(newRoundBlock);
    await jm.initializeRound();
  }

  describe('submitMineral', () => {
    before(async () => {
      jm = await JobManager.deployed();
    });

    it('should fail if category is not MINERAL_COMPUTE or MINERAL_STORAGE', async () => {
      await jm.submitMineral('test', MINERAL_COMPUTE);
      await jm.submitMineral('test', MINERAL_STORAGE);
      await assertFail( jm.submitMineral('test', 2) );
    });

    it('should store the Mineral in the minerals mapping', async () => {
      const mineralId = (await jm.numberOfMinerals.call()).toNumber();
      await jm.submitMineral('multiplication', MINERAL_COMPUTE, {from: accounts[0]});
      const mineral = await jm.minerals.call(mineralId);
      let [name, producer, category] = mineral;
      assert.equal('multiplication', name);
      assert.equal(accounts[0], producer);
      assert.equal(MINERAL_COMPUTE, category);
    });

    it('should increment numberOfMinerals', async () => {
      const numberOfMinerals = await jm.numberOfMinerals.call();
      await jm.submitMineral('addition', MINERAL_COMPUTE);
      assert.deepEqual(numberOfMinerals.add(1), await jm.numberOfMinerals.call());
    });

    it('should emit a MineralAdded event', async () => {
      const mineralId = (await jm.numberOfMinerals.call()).toNumber();
      let result = await jm.submitMineral('division', MINERAL_COMPUTE, {from: accounts[0]});
      assert.web3Event(result, {
        event: 'MineralAdded',
        args: {
          id: mineralId,
          name: 'division',
          producer: accounts[0],
          category: MINERAL_COMPUTE,
        },
      });
    });

    it('should fail if name is an empty string', async () => {
      const mineralId = (await jm.numberOfMinerals.call()).toNumber();
      await assertFail( jm.submitMineral('', MINERAL_COMPUTE) );
      await jm.submitMineral('non empty string', MINERAL_COMPUTE);
      const mineral = await jm.minerals.call(mineralId);
      let name = mineral[0];
      assert.equal('non empty string', name);
    });
  });

  describe('submitJob', () => {
    let expirationBlock = web3.eth.blockNumber + 1000;

    before(async () => {
      await initNew();
      await initializeNewRound();
      await jm.submitMineral('multiplication', MINERAL_COMPUTE);
      await jm.submitMineral('addition', MINERAL_COMPUTE);
    });

    it('should fail if mineralId is not the id of a valid Mineral', async () => {
      await assertFail( jm.submitJob(2, 10, expirationBlock, {from: consumer}) );
      await jm.submitJob(0, 10, expirationBlock, {from: consumer});
    });

    it('should fail if expiration block is not in the future', async () => {
      const blockInThePast = web3.eth.blockNumber;
      await assertFail( jm.submitJob(0, 10, blockInThePast, {from: consumer}) );
      const presentBlock = web3.eth.blockNumber + 1;
      await assertFail( jm.submitJob(0, 10, presentBlock, {from: consumer}) );
      const blockInTheFuture = web3.eth.blockNumber + 2;
      await jm.submitJob(0, 10, blockInTheFuture, {from: consumer});
    });

    it('should store the address of the consumer who submitted the job', async () => {
      const jobId = await jm.numberOfJobs.call();
      await jm.submitJob(1, 10, expirationBlock, {from: consumer});
      const job = await jm.jobs.call(jobId);
      const consumerAddress = job[3];
      assert.equal(consumer, consumerAddress);
    });

    it('should elect a Provider to do the job', async () => {
      const jobId = await jm.numberOfJobs.call();
      await jm.submitJob(1, 10, expirationBlock, {from: consumer});
      const job = await jm.jobs.call(jobId);
      const electedProvider = job[4];
      assert.equal(provider1, electedProvider);
    });

    it('should store the Job parameters in the jobs mapping', async () => {
      const jobId = await jm.numberOfJobs.call();
      await jm.submitJob(1, 11, expirationBlock + 42, {from: consumer});
      const job = await jm.jobs.call(jobId);
      const [mineralId, maxPricePerMineral, expBlock] = job;
      assert.equal(1, mineralId);
      assert.equal(11, maxPricePerMineral);
      assert.equal(expirationBlock + 42, expBlock);
    });

    it('should emit a JobAdded event', async () => {
      const jobId = await jm.numberOfJobs.call();
      let result = await jm.submitJob(1, 10, expirationBlock, {from: consumer});
      assert.web3Event(result, {
        event: 'JobAdded',
        args: {
          id: jobId.toNumber(),
          mineralId: 1,
          maxPricePerMineral: 10,
          expirationBlock: expirationBlock,
          consumerAddress: consumer,
          electedProvider: provider1,
        },
      });
    });

    it('should increment numberOfJobs', async () => {
      const numberOfJobs = await jm.numberOfJobs.call();
      await jm.submitJob(1, 12, expirationBlock, {from: consumer});
      assert.deepEqual(numberOfJobs.add(1), await jm.numberOfJobs.call());
    });
  });

  describe('selectProvider', () => {
    const aFewTimes = 3;

    before(async () => {
      await initNew();
    });

    it('should return null address if there is no active Providers in the pool', async () => {
      // New round is not initialized, so there are no active Providers yet
      const activeProviderAddresses = await jm.getActiveProviderAddresses.call();
      assert.equal(0, activeProviderAddresses.length);
      const maxPricePerMineral = 11;
      const provider = await jm.publicSelectProvider.call(maxPricePerMineral, MINERAL_STORAGE);
      assert.equal(nullAddress, provider);
    });

    it('should select Providers proportionally to their relative stake', async () => {
      // Initialize the active provider set
      await initializeNewRound();

      const maxPricePerMineral = 17;
      const aLotOfTimes = 50;
      const electedProvidersCount = {};
      electedProvidersCount[provider1] = 0;
      electedProvidersCount[provider2] = 0;
      electedProvidersCount[provider3] = 0;
      let i = 0;
      while (i < aLotOfTimes) {
        const provider = await jm.publicSelectProvider.call(maxPricePerMineral, MINERAL_COMPUTE);
        electedProvidersCount[provider] += 1;
        await blockMiner.mine(1);
        i++;
      }
      const totalActiveStake = provider1Stake + provider2Stake + provider3Stake;
      const provider1RelativeStake = provider1Stake / totalActiveStake;
      const provider2RelativeStake = provider2Stake / totalActiveStake;
      const provider3RelativeStake = provider3Stake / totalActiveStake;
      const provider1ElectedRate = electedProvidersCount[provider1] / aLotOfTimes;
      const provider2ElectedRate = electedProvidersCount[provider2] / aLotOfTimes;
      const provider3ElectedRate = electedProvidersCount[provider3] / aLotOfTimes;
      const threshold = 0.15;
      assert.isAbove(threshold, Math.abs(provider1RelativeStake - provider1ElectedRate));
      assert.isAbove(threshold, Math.abs(provider2RelativeStake - provider2ElectedRate));
      assert.isAbove(threshold, Math.abs(provider3RelativeStake - provider3ElectedRate));
    });

    it('should not select Providers who have a pricePerMineral > maxPricePerMineral', async () => {
      const maxPricePerMineral = 11;
      // Even though provider1 has a tiny relative stake in the active Provider pool
      // he will be selected every time because he is the only one who meets the
      // price requirements
      Array(aFewTimes).fill().forEach(async () => {
        const provider = await jm.publicSelectProvider.call(maxPricePerMineral, MINERAL_COMPUTE);
        assert.equal(provider1, provider);
        await blockMiner.mine(1);
      });
    });

    it('should select Providers who have a pricePerMineral == maxPricePerMineral', async () => {
      const maxPricePerMineral = 12;
      const electedProviders = [];
      let i = 0;
      // Try a few times to elect a new Provider
      while (i < aFewTimes) {
        const provider = await jm.publicSelectProvider.call(maxPricePerMineral, MINERAL_COMPUTE);
        electedProviders.push(provider);
        await blockMiner.mine(1);
        i++;
      }
      // provider2 had more than 90% chance to be elected every time
      // so we want to make sure it was selected at least once
      // in the few tries we did
      const provider2WasSelectedAtLeastOnce = electedProviders
        .some((provider) => provider2 === provider);
      assert.ok(provider2WasSelectedAtLeastOnce);
    });

    it('should return a null address if all Providers have pricePerMineral > maxPricePerMineral', async () => {
      const maxPricePerMineral = 9;
      Array(aFewTimes).fill().forEach(async () => {
        const provider = await jm.publicSelectProvider.call(maxPricePerMineral, MINERAL_COMPUTE);
        assert.equal(nullAddress, provider);
        await blockMiner.mine(1);
      });
    });
  });
});
