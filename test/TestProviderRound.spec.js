const ProviderRound = artifacts.require('./ProviderRound.sol');
const { blockMiner, assertFail } = require('./utils.js');
require('truffle-test-utils').init();

contract('ProviderRound', accounts => {

  let providerRound;
  let contractAddress;
  const PROVIDER_NULL = 0;
  const PROVIDER_REGISTERED = 1;

  async function approveBondProvider(pricePerStorageMineral, pricePerComputeMineral, blockRewardCut, feeShare, amountBonded, providerAddress) {
      await providerRound.approve(contractAddress, amountBonded, {from: providerAddress});
      await providerRound.bond(providerAddress, amountBonded, {from: providerAddress});
      await providerRound.provider(pricePerStorageMineral, pricePerComputeMineral, blockRewardCut, feeShare, {from: providerAddress});
  }

  describe('provider', () => {

    before(async () => {
      providerRound = await ProviderRound.deployed();
      contractAddress = providerRound.address;
      for(let i = 0; i < 5; i++) {
        await providerRound.mint(accounts[i], 1000, {from: accounts[0]});
      }
    });

    beforeEach(async () => {
      await blockMiner.mineUntilEndOfElectionPeriod(providerRound);
      await providerRound.initializeRound();
    });

    it("should register a provider's parameters", async () => {
      await approveBondProvider(10, 20, 2, 35, 1, accounts[1]);
      const provider = await providerRound.providers.call(accounts[1]);
      assert.equal(provider[0], PROVIDER_REGISTERED); // [0] is providerStatus
      assert.equal(provider[1].toNumber(), 10); // [1] is pricePerStorageMineral
      assert.equal(provider[2].toNumber(), 20); // [2] is pricePerComputeMineral
      assert.equal(provider[3].toNumber(), 2);  // [3] is blockRewardCut
      assert.equal(provider[4].toNumber(), 35); // [4] is feeShare
    });

    it('should fail with invalid parameters', async() => {
      await assertFail(
        approveBondProvider(22, 10, -1, 25, 1, accounts[2]),
        'provider should not be able to have a negative blockRewardCut'
      );
      await assertFail(
        providerRound.provider(22, 10, 1, 125, {from: accounts[2]}),
        'provider should not be able to have more than 100% feeShare'
      );
    });

    it('should fail if not called during an active round', async () => {
      await blockMiner.mineUntilEndOfElectionPeriod(providerRound);
      await assertFail( providerRound.provider(22, 10, 1, 25, {from: accounts[0]}) );
    });

    it('should work if called before the lock period of an active round', async () => {
      await blockMiner.mineUntilLastBlockBeforeLockPeriod(providerRound);
      await providerRound.provider(22, 10, 1, 25, {from: accounts[0]});
    });

    it('should fail during the lock period of an active round', async () => {
      await blockMiner.mineUntilLastBlockBeforeLockPeriod(providerRound);
      // Enter lock period
      await blockMiner.mine(1);
      await assertFail( providerRound.provider(22, 10, 1, 25, {from: accounts[0]}) );
    });

    it('should send a ProviderAdded event for a new provider', async () => {
      const result = await providerRound.provider(22, 10, 1, 25, {from: accounts[2]});
      assert.web3Event(result, {
        event: 'ProviderAdded',
        args: {
          _providerAddress: accounts[2],
          _pricePerStorageMineral: 22,
          _pricePerComputeMineral: 10,
          _blockRewardCut: 1,
          _feeShare: 25,
        }
      });
    });

    it('should send a ProviderUpdated event for an existing provider', async () => {
      const result = await providerRound.provider(21, 11, 2, 24, {from: accounts[2]});
      assert.web3Event(result, {
        event: 'ProviderUpdated',
        args: {
          _providerAddress: accounts[2],
          _pricePerStorageMineral: 21,
          _pricePerComputeMineral: 11,
          _blockRewardCut: 2,
          _feeShare: 24,
        }
      });
    });

  });

  describe('resignAsProvider', () => {

    before(async () => {
      providerRound = await ProviderRound.new();
      contractAddress = providerRound.address;
      for(let i = 0; i < 5; i++) {
        await providerRound.mint(accounts[i], 1000, {from: accounts[0]});
      }
      await blockMiner.mineUntilEndOfElectionPeriod(providerRound);
      await providerRound.initializeRound();
      await approveBondProvider(22, 10, 1, 25, 1, accounts[0]);
      await approveBondProvider(22, 10, 1, 25, 1, accounts[1]);
    });

    it('should remove a provider from the provider mapping', async () => {
      const registeredProvider = await providerRound.providers.call(accounts[0]);
      assert.equal(PROVIDER_REGISTERED, registeredProvider[0]); // [0] is providerStatus
      await providerRound.resignAsProvider({from: accounts[0]});
      const resignedProvider = await providerRound.providers.call(accounts[0]);
      assert.equal(PROVIDER_NULL, resignedProvider[0]); // [0] is providerStatus
      assert.equal(0, resignedProvider[1]); // [1] is pricePerStorageMineral
      assert.equal(0, resignedProvider[2]); // [2] is pricePerComputeMineral
      assert.equal(0, resignedProvider[3]); // [3] is blockRewardCut
      assert.equal(0, resignedProvider[4]); // [4] is feeShare
      assert.equal(0, resignedProvider[5]); // [5] is totalAmountBonded
    });

    it('should send a ProviderResigned event', async () => {
      const result = await providerRound.resignAsProvider({from: accounts[1]});
      assert.web3Event(result, {
        event: 'ProviderResigned',
        args: {
          _providerAddress: accounts[1],
        }
      });
    });

    it("should fail if the transaction's sender is not a provider", async () => {
      await assertFail( providerRound.resignAsProvider({from: accounts[2]}) );
    });
  });

  describe('bond', () => {

    before(async () => {
      providerRound = await ProviderRound.new();
      contractAddress = providerRound.address;
      for(let i = 0; i < 10; i++) {
        await providerRound.mint(accounts[i], 1000, {from: accounts[0]});
      }
      await blockMiner.mineUntilEndOfElectionPeriod(providerRound);
      await providerRound.initializeRound();
      await approveBondProvider(22, 10, 1, 25, 1, accounts[0]);
      await approveBondProvider(10, 20, 2, 35, 1, accounts[1]);
    });

    it('should fail if the delegator does not approve to transfer at least the bonded amount', async () => {
      await assertFail( providerRound.bond(accounts[0], 10, {from: accounts[5]}) );
      await providerRound.approve(contractAddress, 9, {from: accounts[5]});
      await assertFail( providerRound.bond(accounts[0], 10, {from: accounts[5]}) );
    });

    it('should add a delegator to the delegators list', async () => {
      await providerRound.approve(contractAddress, 10, {from: accounts[5]});
      await providerRound.bond(accounts[0], 10, {from: accounts[5]});
      const firstDelegator = await providerRound.delegators.call(accounts[5]);
      assert.equal(accounts[0], firstDelegator[0]); // [0] is delegateAddress
      assert.equal(10, firstDelegator[1]); // [1] is amountBonded
    });

    it('should increase the totalAmountBonded of the provider', async () => {
      let firstProvider = await providerRound.providers.call(accounts[0]);
      assert.equal(11, firstProvider[5]);
      await providerRound.approve(contractAddress, 20, {from: accounts[6]});
      await providerRound.bond(accounts[1], 20, {from: accounts[6]});
      await providerRound.approve(contractAddress, 50, {from: accounts[7]});
      await providerRound.bond(accounts[1], 50, {from: accounts[7]});
      firstProvider = await providerRound.providers.call(accounts[0]);
      const secondProvider = await providerRound.providers.call(accounts[1]);
      assert.equal(11, firstProvider[5]); // [5] is totalAmountBonded
      assert.equal(71, secondProvider[5]); // [5] is totalAmountBonded
    });

    it('should fail if no providerCandidate is associated with the given providerCandidateId', async () => {
      await assertFail( providerRound.bond(accounts[2], 15, {from: accounts[5]}) );
    });

    it('should fail if called twice by the same delegator', async () => {
      await providerRound.approve(contractAddress, 40, {from: accounts[8]});
      await providerRound.bond(accounts[1], 40, {from: accounts[8]});
      await assertFail( providerRound.bond(accounts[1], 40, {from: accounts[8]}) );
    });

    it('should fail if TST balance is less than bonded amount', async () => {
      await providerRound.approve(contractAddress, 1001, {from: accounts[9]});
      await assertFail( providerRound.bond(accounts[1], 1001, {from: accounts[9]}) )
      assert.equal(111, (await providerRound.providers(accounts[1]))[5]);
    });

    it("should transfer amount from the delegator's balance to the contract's balance", async () => {
      const contractBalance = (await providerRound.balanceOf(providerRound.address)).toNumber();
      assert.equal(1000, await providerRound.balanceOf(accounts[9]));
      await providerRound.approve(contractAddress, 300, {from: accounts[9]});
      await providerRound.bond(accounts[1], 300, {from: accounts[9]});
      assert.equal(700, await providerRound.balanceOf(accounts[9]));
      assert.equal(contractBalance + 300, await providerRound.balanceOf(providerRound.address));
    });
  });
});

