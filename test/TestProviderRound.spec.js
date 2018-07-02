const ProviderRound = artifacts.require('./ProviderRound.sol');
const { blockMiner, assertFail } = require('./utils.js');
require('truffle-test-utils').init();

contract('ProviderRound', accounts => {

  let providerRound;
  const PROVIDER_NULL = 0;
  const PROVIDER_REGISTERED = 1;

  describe('provider', () => {

    before(async () => {
      providerRound = await ProviderRound.deployed();
    });

    beforeEach(async () => {
      await blockMiner.mineUntilEndOfElectionPeriod(providerRound);
      await providerRound.initializeRound();
    });

    it("should register a provider's parameters", async () => {
      await providerRound.provider(22, 10, 1, 25, {from: accounts[0]});
      await providerRound.provider(10, 20, 2, 35, {from: accounts[1]});
      const firstProvider = await providerRound.providers.call(accounts[0]);
      assert.equal(firstProvider[0], PROVIDER_REGISTERED); // [0] is providerStatus
      assert.equal(firstProvider[1].toNumber(), 22); // [1] is pricePerStorageMineral
      assert.equal(firstProvider[2].toNumber(), 10); // [2] is pricePerComputeMineral
      assert.equal(firstProvider[3].toNumber(), 1);  // [3] is blockRewardCut
      assert.equal(firstProvider[4].toNumber(), 25); // [4] is feeShare
      const secondProvider = await providerRound.providers.call(accounts[1]);
      assert.equal(secondProvider[0], PROVIDER_REGISTERED); // [0] is providerStatus
      assert.equal(secondProvider[1].toNumber(), 10); // [1] is pricePerStorageMineral
      assert.equal(secondProvider[2].toNumber(), 20); // [2] is pricePerComputeMineral
      assert.equal(secondProvider[3].toNumber(), 2);  // [3] is blockRewardCut
      assert.equal(secondProvider[4].toNumber(), 35); // [4] is feeShare
    });

    it('should fail with invalid parameters', async() => {
      await assertFail(
        providerRound.provider(22, 10, -1, 25, {from: accounts[2]}),
        'provider should not be able to have a negative blockRewardCut'
      );
      await assertFail(
        providerRound.provider(22, 10, 1, 125, {from: accounts[2]}),
        'provider should not be able to have more than 100% feeShare'
      );
    });

    it('should set totalBondedAmount to 0', async () => {
      const firstProvider = await providerRound.providers.call(accounts[0]);
      assert.equal(0, firstProvider[5]); // [5] is totalBondedAmount
    });

    it('should fail if not called during an active round', async () => {
      await blockMiner.mineUntilEndOfElectionPeriod(providerRound);
      await assertFail( providerRound.provider(22, 10, 1, 25) );
    });

    it('should register parameters before the lock period of an active round', async () => {
      await blockMiner.mineUntilLastBlockBeforeLockPeriod(providerRound);
      await providerRound.provider(22, 10, 1, 25);
    });

    it('should fail during the lock period of an active round', async () => {
      await blockMiner.mineUntilLastBlockBeforeLockPeriod(providerRound);
      // Enter lock period
      await blockMiner.mine(1);
      await assertFail( providerRound.provider(22, 10, 1, 25) );
    });

    it('should send a ProviderAdded event for a new provider', async () => {
      const result = await providerRound.provider(22, 10, 1, 25, {from: accounts[3]});
      assert.web3Event(result, {
        event: 'ProviderAdded',
        args: {
          _providerAddress: accounts[3],
          _pricePerStorageMineral: 22,
          _pricePerComputeMineral: 10,
          _blockRewardCut: 1,
          _feeShare: 25,
        }
      });
    });

    it('should send a ProviderUpdated event for an existing provider', async () => {
      const result = await providerRound.provider(21, 11, 2, 24, {from: accounts[3]});
      assert.web3Event(result, {
        event: 'ProviderUpdated',
        args: {
          _providerAddress: accounts[3],
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
      await blockMiner.mineUntilEndOfElectionPeriod(providerRound);
      await providerRound.initializeRound();
    });

    it('should remove a provider from the provider mapping', async () => {
      await providerRound.provider(22, 10, 1, 25, {from: accounts[0]});
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
      await providerRound.provider(22, 10, 1, 25, {from: accounts[1]});
      const result = await providerRound.resignAsProvider({from: accounts[1]});
      assert.web3Event(result, {
        event: 'ProviderResigned',
        args: {
          _providerAddress: accounts[1],
        }
      });
    });

    it("should fail if the transaction's sender is not a provider", async () => {
      await assertFail( providerRound.resignAsProvider({from: accounts[1]}) );
    });
  });

  describe('bond', () => {

    let contractAddress;

    before(async () => {
      providerRound = await ProviderRound.new({from: accounts[0]});
      contractAddress = providerRound.address;
      for(let i = 5; i < 10; i++) {
        await providerRound.mint(accounts[i], 1000, {from: accounts[0]});
      }
      await blockMiner.mineUntilEndOfElectionPeriod(providerRound);
      await providerRound.initializeRound();
      await providerRound.provider(22, 10, 1, 25, {from: accounts[0]});
      await providerRound.provider(10, 20, 2, 35, {from: accounts[1]});
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
      assert.equal(10, firstProvider[5]);
      await providerRound.approve(contractAddress, 20, {from: accounts[6]});
      await providerRound.bond(accounts[1], 20, {from: accounts[6]});
      await providerRound.approve(contractAddress, 50, {from: accounts[7]});
      await providerRound.bond(accounts[1], 50, {from: accounts[7]});
      firstProvider = await providerRound.providers.call(accounts[0]);
      const secondProvider = await providerRound.providers.call(accounts[1]);
      assert.equal(10, firstProvider[5]); // [5] is totalAmountBonded
      assert.equal(70, secondProvider[5]); // [5] is totalAmountBonded
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
      assert.equal(110, (await providerRound.providers(accounts[1]))[5]);
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

