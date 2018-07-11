const TransmuteDPOS = artifacts.require('./TransmuteDPOS.sol');
const { blockMiner, assertFail } = require('./utils.js');
require('truffle-test-utils').init();

contract('TransmuteDPOS', accounts => {

  let tdpos;
  let contractAddress;
  const PROVIDER_POOL_SIZE = 5;
  const PROVIDER_UNREGISTERED = 0;
  const PROVIDER_REGISTERED = 1;

  // This is a convenience function for the process of registering a new provider.
  // Step 1: Approve the transfer of amountBonded tokens (ERC20 spec)
  // Step 2: Bond the amount to the provider
  // Step 3: Registering parameters with provider()
  async function approveBondProvider(pricePerStorageMineral, pricePerComputeMineral, blockRewardCut, feeShare, amountBonded, providerAddress) {
      // This approve function comes from the ERC20 Transmute Token contract
      await tdpos.approve(contractAddress, amountBonded, {from: providerAddress});
      await tdpos.bond(providerAddress, amountBonded, {from: providerAddress});
      await tdpos.provider(pricePerStorageMineral, pricePerComputeMineral, blockRewardCut, feeShare, {from: providerAddress});
  }

  describe('provider', () => {

    before(async () => {
      tdpos = await TransmuteDPOS.deployed();
      contractAddress = tdpos.address;
      for(let i = 0; i < 5; i++) {
        await tdpos.mint(accounts[i], 1000, {from: accounts[0]});
      }
      await tdpos.setMaxNumberOfProviders(PROVIDER_POOL_SIZE);
    });

    beforeEach(async () => {
      await blockMiner.mineUntilEndOfElectionPeriod(tdpos);
      await tdpos.initializeRound();
    });

    it('should fail if the provider does not bond some tokens on himself first', async () => {
      await assertFail( tdpos.provider(22, 10, 1, 25, {from: accounts[0]}) );
    });

    it('should initially set totalBondedAmount to the amount the provider bonded to himself', async () => {
      await approveBondProvider(22, 10, 1, 25, 42, accounts[0]);
      const provider = await tdpos.providers.call(accounts[0]);
      assert.equal(42, provider[5]); // [5] is totalBondedAmount
    });

    it("should register a provider's parameters", async () => {
      await approveBondProvider(10, 20, 2, 35, 1, accounts[1]);
      const provider = await tdpos.providers.call(accounts[1]);
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
        tdpos.provider(22, 10, 1, 125, {from: accounts[2]}),
        'provider should not be able to have more than 100% feeShare'
      );
    });

    it('should fail if not called during an active round', async () => {
      await blockMiner.mineUntilEndOfElectionPeriod(tdpos);
      await assertFail( tdpos.provider(22, 10, 1, 25, {from: accounts[0]}) );
    });

    it('should work if called before the lock period of an active round', async () => {
      await blockMiner.mineUntilLastBlockBeforeLockPeriod(tdpos);
      await tdpos.provider(23, 10, 1, 25, {from: accounts[0]});
      const provider = await tdpos.providers(accounts[0]);
      assert.equal(23, provider[1]); // [1] is pricePerStorageMineral
    });

    it('should fail during the lock period of an active round', async () => {
      await blockMiner.mineUntilLastBlockBeforeLockPeriod(tdpos);
      // Enter lock period
      await blockMiner.mine(1);
      await assertFail( tdpos.provider(22, 10, 1, 25, {from: accounts[0]}) );
    });

    it('should send a ProviderAdded event for a new provider', async () => {
      const result = await tdpos.provider(22, 10, 1, 25, {from: accounts[2]});
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
      const result = await tdpos.provider(21, 11, 2, 24, {from: accounts[2]});
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

    it('should add the provider to the pool if he is Unregistered and size < maxSize', async () => {
      // Check that provider isn't registered yet
      assert.equal(false, await tdpos.containsProvider(accounts[3]));
      // Check the size of the pool increases by 1
      let providerPool = await tdpos.providerPool.call();
      const previousSize = providerPool[3].toNumber(); // [3] is current size of the pool
      await approveBondProvider(21, 13, 3, 26, 1, accounts[3]);
      providerPool = await tdpos.providerPool.call();
      assert.equal(previousSize + 1, providerPool[3]);
      // Check that the provider is registered in the pool now
      assert.equal(true, await tdpos.containsProvider(accounts[3]));
    });

    it('should fail if provider is Unregistered and size == maxSize', async () => {
      let providerPool = await tdpos.providerPool.call();
      const maxSize = providerPool[2].toNumber(); // [2] is maxSize
      let currentSize = providerPool[3]; // [3] is current size
      assert.isAbove(maxSize, currentSize.toNumber());
      await approveBondProvider(20 ,10, 2, 25, 1, accounts[4]);
      providerPool = await tdpos.providerPool.call();
      currentSize = providerPool[3];
      assert.equal(maxSize, currentSize);
      await assertFail( approveBondProvider(20 ,10, 2, 25, 1, accounts[5]) );
    });

    it('should update the value of totalBondedAmount in the providerPool if the provider is Registered and size < maxSize', async () => {
      // Check that provider is Registered
      assert.equal(true, await tdpos.containsProvider(accounts[3]));
      // Check the size of the pool stays the same
      let providerPool = await tdpos.providerPool.call();
      const previousSize = providerPool[3]; // [3] is current size of the pool
      await tdpos.provider(19, 10, 2, 20, {from: accounts[3]});
      providerPool = await tdpos.providerPool.call();
      assert.deepEqual(previousSize, providerPool[3]);
    });

    it('should work if provider is Registered and size == maxSize', async () => {
      await tdpos.provider(21 ,10, 2, 25, {from: accounts[4]});
    });
  });

  describe('resignAsProvider', () => {

    before(async () => {
      tdpos = await TransmuteDPOS.new();
      contractAddress = tdpos.address;
      for(let i = 0; i < 5; i++) {
        await tdpos.mint(accounts[i], 1000, {from: accounts[0]});
      }
      await tdpos.setMaxNumberOfProviders(PROVIDER_POOL_SIZE);
      await blockMiner.mineUntilEndOfElectionPeriod(tdpos);
      await tdpos.initializeRound();
      await approveBondProvider(22, 10, 1, 25, 1, accounts[0]);
      await approveBondProvider(22, 10, 1, 25, 1, accounts[1]);
      await approveBondProvider(22, 10, 1, 25, 1, accounts[2]);
    });

    it('should remove the provider from the provider mapping', async () => {
      const registeredProvider = await tdpos.providers.call(accounts[0]);
      assert.equal(PROVIDER_REGISTERED, registeredProvider[0]); // [0] is providerStatus
      await tdpos.resignAsProvider({from: accounts[0]});
      const resignedProvider = await tdpos.providers.call(accounts[0]);
      assert.equal(PROVIDER_UNREGISTERED, resignedProvider[0]); // [0] is providerStatus
      assert.equal(0, resignedProvider[1]); // [1] is pricePerStorageMineral
      assert.equal(0, resignedProvider[2]); // [2] is pricePerComputeMineral
      assert.equal(0, resignedProvider[3]); // [3] is blockRewardCut
      assert.equal(0, resignedProvider[4]); // [4] is feeShare
      assert.equal(0, resignedProvider[5]); // [5] is totalAmountBonded
    });

    it('should remove the provider from the providerPool', async () => {
      assert.equal(true, await tdpos.containsProvider(accounts[1]));
      await tdpos.resignAsProvider({from: accounts[1]});
      assert.equal(false, await tdpos.containsProvider(accounts[1]));
    });

    it('should send a ProviderResigned event', async () => {
      const result = await tdpos.resignAsProvider({from: accounts[2]});
      assert.web3Event(result, {
        event: 'ProviderResigned',
        args: {
          _providerAddress: accounts[2],
        }
      });
    });

    it("should fail if the transaction's sender is not a provider", async () => {
      await assertFail( tdpos.resignAsProvider({from: accounts[3]}) );
    });
  });

  describe('bond', () => {

    before(async () => {
      tdpos = await TransmuteDPOS.new();
      contractAddress = tdpos.address;
      for(let i = 0; i < 10; i++) {
        await tdpos.mint(accounts[i], 1000, {from: accounts[0]});
      }
      await tdpos.setMaxNumberOfProviders(PROVIDER_POOL_SIZE);
      await blockMiner.mineUntilEndOfElectionPeriod(tdpos);
      await tdpos.initializeRound();
      await approveBondProvider(22, 10, 1, 25, 1, accounts[0]);
      await approveBondProvider(10, 20, 2, 35, 1, accounts[1]);
    });

    it('should fail if the delegator does not approve to transfer at least the bonded amount', async () => {
      await assertFail( tdpos.bond(accounts[0], 10, {from: accounts[5]}) );
      await tdpos.approve(contractAddress, 9, {from: accounts[5]});
      await assertFail( tdpos.bond(accounts[0], 10, {from: accounts[5]}) );
    });

    it('should add a delegator to the delegators list', async () => {
      await tdpos.approve(contractAddress, 10, {from: accounts[5]});
      await tdpos.bond(accounts[0], 10, {from: accounts[5]});
      const firstDelegator = await tdpos.delegators.call(accounts[5]);
      assert.equal(accounts[0], firstDelegator[0]); // [0] is delegateAddress
      assert.equal(10, firstDelegator[1]); // [1] is amountBonded
    });

    it('should increase the totalAmountBonded of the provider', async () => {
      await tdpos.approve(contractAddress, 20, {from: accounts[6]});
      await tdpos.bond(accounts[0], 20, {from: accounts[6]});
      const provider = await tdpos.providers.call(accounts[0]);
      assert.equal(31, provider[5].toNumber()); // [5] is totalAmountBonded
    });

    it('should fail if the address is not a registered provider address', async () => {
      await tdpos.approve(contractAddress, 15, {from: accounts[7]})
      await assertFail( tdpos.bond(accounts[2], 15, {from: accounts[7]}) );
    });

    it('should work if the address is not a registered provider address but the address is the sender address', async () => {
      await tdpos.approve(contractAddress, 15, {from: accounts[3]})
      await tdpos.bond(accounts[3], 15, {from: accounts[3]});
    });

    it('should fail if called twice by the same delegator', async () => {
      await tdpos.approve(contractAddress, 40, {from: accounts[8]});
      await tdpos.bond(accounts[1], 20, {from: accounts[8]});
      await assertFail( tdpos.bond(accounts[1], 20, {from: accounts[8]}) );
    });

    it('should fail if TST balance is less than bonded amount', async () => {
      await tdpos.approve(contractAddress, 1001, {from: accounts[9]});
      await assertFail( tdpos.bond(accounts[1], 1001, {from: accounts[9]}) )
      assert(1001 >= (await tdpos.providers(accounts[1]))[5]);
    });

    it("should transfer amount from the delegator's balance to the contract's balance", async () => {
      const contractBalance = (await tdpos.balanceOf(tdpos.address)).toNumber();
      assert.equal(1000, await tdpos.balanceOf(accounts[9]));
      await tdpos.approve(contractAddress, 300, {from: accounts[9]});
      await tdpos.bond(accounts[1], 300, {from: accounts[9]});
      assert.equal(700, await tdpos.balanceOf(accounts[9]));
      assert.equal(contractBalance + 300, await tdpos.balanceOf(tdpos.address));
    });
  });
});
