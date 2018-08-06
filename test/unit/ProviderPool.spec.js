// Here we use the TestProviderPool contract instead of the ProviderPool
// This is to be able to test the addProvider function which has internal visibility
// through the publicAddProvider function from TestProviderPool which has public visibility
const ProviderPool = artifacts.require('./TestProviderPool.sol');
const {assertFail} = require('../utils.js');

contract('ProviderPool', (accounts) => {
  let pp;

  async function assertProvidersAreSortedByBondedAmount() {
    // Start at the head of the linked list and go through all nodes
    // to verify that the bondedAmounts are in decreasing order
    let bondedAmountOfPreviousAddress = Number.POSITIVE_INFINITY;
    let previousAddress = 0;
    let currentAddress = await pp.getFirstProvider.call();
    let node = await pp.getProvider.call(currentAddress);
    let end = await pp.getLastProvider.call();
    while (currentAddress != end) {
      assert(bondedAmountOfPreviousAddress >= node[0]); // [0] is the bondedAmount
      assert.equal(node[2], previousAddress); // [2] is previous address in the list
      bondedAmountOfPreviousAddress = node[0].toNumber();
      previousAddress = currentAddress;
      currentAddress = node[1]; // [1] is next address in the list
      node = await pp.getProvider.call(currentAddress);
    }
  }

  describe('setProviderPoolMaxSize', () => {
    const SIZE = 5;
    let owner = accounts[0];
    let provider1 = accounts[1];
    let provider2 = accounts[2];
    let provider3 = accounts[3];
    let provider4 = accounts[4];
    let provider5 = accounts[5];
    let unregistered = accounts[6];

    before(async () => {
      pp = await ProviderPool.deployed({from: owner});
    });

    it('should set the max number of providers allowed in the pool', async () => {
      assert.equal(0, await pp.getProviderPoolMaxSize());
      await pp.setProviderPoolMaxSize(7, {from: owner});
      assert.equal(7, await pp.getProviderPoolMaxSize());
    });

    it('should fail if it is not called from the owner\'s address', async () => {
      await assertFail( pp.setProviderPoolMaxSize(10, {from: provider1}) );
    });

    describe('newMaxSize == currentSize', () => {
      before(async () => {
        await pp.publicAddProvider(provider1, 1);
        await pp.publicAddProvider(provider2, 5);
        await pp.publicAddProvider(provider3, 2);
        await pp.publicAddProvider(provider4, 4);
        await pp.publicAddProvider(provider5, 3);
        await pp.setProviderPoolMaxSize(SIZE);
      });

      it('should set maxSize', async () => {
        const maxSize = await pp.getProviderPoolMaxSize();
        assert.equal(SIZE, maxSize);
      });

      it('should not affect the size of the pool', async () => {
        const size = await pp.getProviderPoolSize();
        assert.equal(SIZE, size);
      });

      it('should not affect the content of the pool', async () => {
        assert.equal(true, await pp.containsProvider(provider1));
        assert.equal(true, await pp.containsProvider(provider2));
        assert.equal(true, await pp.containsProvider(provider3));
        assert.equal(true, await pp.containsProvider(provider4));
        assert.equal(true, await pp.containsProvider(provider5));
        assert.equal(false, await pp.containsProvider(unregistered));
      });
    });

    describe('newMaxSize > currentSize', () => {
      before(async () => {
        await pp.setProviderPoolMaxSize(SIZE + 1);
      });

      it('should set maxSize', async () => {
        const maxSize = await pp.getProviderPoolMaxSize();
        assert.equal(SIZE + 1, maxSize);
      });

      it('should not affect the size of the pool', async () => {
        const size = await pp.getProviderPoolSize();
        assert.equal(SIZE, size);
      });

      it('should not affect the content of the pool', async () => {
        assert.equal(true, await pp.containsProvider(provider1));
        assert.equal(true, await pp.containsProvider(provider2));
        assert.equal(true, await pp.containsProvider(provider3));
        assert.equal(true, await pp.containsProvider(provider4));
        assert.equal(true, await pp.containsProvider(provider5));
        assert.equal(false, await pp.containsProvider(unregistered));
      });
    });

    describe('newMaxSize < currentSize', () => {
      before(async () => {
        await pp.setProviderPoolMaxSize(SIZE - 2);
      });

      it('should set maxSize', async () => {
        const maxSize = await pp.getProviderPoolMaxSize();
        assert.equal(SIZE - 2, maxSize);
      });

      it('should decrease the size of the pool to newMaxSize', async () => {
        const size = await pp.getProviderPoolSize();
        assert.equal(SIZE - 2, size);
      });

      it('should kick the providers with lowest stake out', async () => {
        // provider1 and provider3 are the ones who had the lowest stake
        assert.equal(false, await pp.containsProvider(provider1));
        assert.equal(true, await pp.containsProvider(provider2));
        assert.equal(false, await pp.containsProvider(provider3));
        assert.equal(true, await pp.containsProvider(provider4));
        assert.equal(true, await pp.containsProvider(provider5));
        assert.equal(false, await pp.containsProvider(unregistered));
      });
    });
  });

  describe('setNumberOfActiveProviders', () => {
    it('should set the number of active providers', async () => {
      let numberOfActiveProviders = await pp.numberOfActiveProviders.call();
      assert.equal(0, numberOfActiveProviders); // max size
      await pp.setNumberOfActiveProviders(5, {from: accounts[0]});
      numberOfActiveProviders = await pp.numberOfActiveProviders.call();
      assert.equal(5, numberOfActiveProviders);
    });

    it('should fail if it is not called from the owner\'s address', async () => {
      await assertFail( pp.setNumberOfActiveProviders(7, {from: accounts[1]}) );
    });

    it('should fail if new value is more than pool maxSize', async () => {
      await assertFail( pp.setNumberOfActiveProviders(8, {from: accounts[0]}) );
    });

    it('should work if new value is less or equal than pool maxSize', async () => {
      await pp.setNumberOfActiveProviders(7, {from: accounts[0]});
      await pp.setNumberOfActiveProviders(6, {from: accounts[0]});
    });
  });

  describe('addProvider', () => {
    it('should add a provider to the pool', async () => {
      assert.equal(0, await pp.getFirstProvider());
      assert.equal(0, await pp.getLastProvider());
      assert.equal(0, await pp.getProviderPoolSize());
      await pp.publicAddProvider(accounts[1], 10);
      assert.equal(accounts[1], await pp.getFirstProvider());
      assert.equal(accounts[1], await pp.getLastProvider());
      assert.equal(1, await pp.getProviderPoolSize());
    });

    it('should keep the list sorted by descending order of bondedAmount', async () => {
      await pp.publicAddProvider(accounts[2], 6);
      await assertProvidersAreSortedByBondedAmount();
      await pp.publicAddProvider(accounts[3], 13);
      await assertProvidersAreSortedByBondedAmount();
      await pp.publicAddProvider(accounts[4], 2);
      await assertProvidersAreSortedByBondedAmount();
      await pp.publicAddProvider(accounts[5], 8);
      await assertProvidersAreSortedByBondedAmount();
      await pp.publicAddProvider(accounts[6], 8);
      await assertProvidersAreSortedByBondedAmount();
    });

    it('should fail if the same address is added twice', async () => {
      await assertFail( pp.publicAddProvider(accounts[6], 15) );
    });

    it('should fail if pool size exceeds maxSize', async () => {
      // Max size is 7, the 7th account should make it
      await pp.publicAddProvider(accounts[7], 15);
      // And the 8th should fail
      await assertFail( pp.publicAddProvider(accounts[8], 15) );
    });
  });

  describe('containsProvider', () => {
    before(async () => {
      pp = await ProviderPool.new();
      await pp.setProviderPoolMaxSize(10, {from: accounts[0]});
    });

    it('should return false if provider is not in the pool', async () => {
      assert.equal(false, await pp.containsProvider(accounts[0]));
    });

    it('should return true if provider is in the pool', async () => {
      await pp.publicAddProvider(accounts[0], 1);
      assert.equal(true, await pp.containsProvider(accounts[0]));
    });
  });

  describe('updateProvider', () => {
    before(async () => {
      pp = await ProviderPool.new();
      await pp.setProviderPoolMaxSize(10, {from: accounts[0]});
      await pp.publicAddProvider(accounts[0], 1);
      await pp.publicAddProvider(accounts[1], 12);
      await pp.publicAddProvider(accounts[2], 3);
      await pp.publicAddProvider(accounts[3], 15);
      await pp.publicAddProvider(accounts[4], 8);
    });

    it('should update the new key', async () => {
      let provider = await pp.getProvider(accounts[0]);
      let providerStake = provider[0];
      assert.equal(1, providerStake);
      await pp.publicUpdateProvider(accounts[0], 9);
      provider = await pp.getProvider(accounts[0]);
      providerStake = provider[0];
      assert.equal(9, providerStake);
    });

    it('should keep the value sorted', async () => {
      await pp.publicUpdateProvider(accounts[1], 10);
      await assertProvidersAreSortedByBondedAmount();
    });

    it('should maintain the size of the pool constant', async () => {
      const previousSize = await pp.getProviderPoolSize();
      await pp.publicUpdateProvider(accounts[2], 20);
      assert.deepEqual(previousSize, await pp.getProviderPoolSize());
    });

    it('should remove the provider if updated providerStake is zero', async () => {
      const previousSize = await pp.getProviderPoolSize();
      assert.equal(true, await pp.containsProvider(accounts[2]));
      await pp.publicUpdateProvider(accounts[2], 0);
      assert.equal(false, await pp.containsProvider(accounts[2]));
      assert.equal(previousSize - 1, await pp.getProviderPoolSize());
    });

    it('should fail if updated provider is not in the pool', async () => {
      await assertFail( pp.publicUpdateProvider(accounts[5], 1) );
    });
  });

  describe('removeProvider', () => {
    it('should remove the provider from the pool', async () => {
      assert.equal(true, await pp.containsProvider(accounts[0]));
      await pp.publicRemoveProvider(accounts[0]);
      assert.equal(false, await pp.containsProvider(accounts[0]));
    });

    it('should decrease the size of the pool by one', async () => {
      const previousSize = await pp.getProviderPoolSize();
      await pp.publicRemoveProvider(accounts[1]);
      assert.equal(previousSize - 1, await pp.getProviderPoolSize());
    });

    it('should keep the list in decreasing order of bonded amounts', async () => {
      await assertProvidersAreSortedByBondedAmount();
      await pp.publicRemoveProvider(accounts[3]);
      await assertProvidersAreSortedByBondedAmount();
      await pp.publicRemoveProvider(accounts[4]);
      await assertProvidersAreSortedByBondedAmount();
    });

    it('should fail if provider is not in the pool', async () => {
      assert.equal(false, await pp.containsProvider(accounts[0]));
      await assertFail( pp.publicRemoveProvider(accounts[0]) );
    });
  });
});

