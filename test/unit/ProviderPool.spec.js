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
    let providerPool = await pp.providerPool.call();
    let currentAddress = providerPool[0]; // [0] is head of the list
    let node = await pp.getProvider.call(currentAddress);
    let end = providerPool[1]; // [1] is tail of the list
    while (currentAddress != end) {
      assert(bondedAmountOfPreviousAddress >= node[0]); // [0] is the bondedAmount
      assert.equal(node[2], previousAddress); // [2] is previous address in the list
      bondedAmountOfPreviousAddress = node[0].toNumber();
      previousAddress = currentAddress;
      currentAddress = node[1]; // [1] is next address in the list
      node = await pp.getProvider.call(currentAddress);
    }
  }

  describe('setMaxNumberOfProviders', () => {
    before(async () => {
      pp = await ProviderPool.deployed();
    });

    it('should set the max number of providers allowed in the pool', async () => {
      let providerPool = await pp.providerPool.call();
      assert.equal(0, providerPool[2]); // max size
      await pp.setMaxNumberOfProviders(7, {from: accounts[0]});
      providerPool = await pp.providerPool.call();
      assert.equal(7, providerPool[2]);
    });

    it('should fail if it is not called from the owner\'s address', async () => {
      await assertFail( pp.setMaxNumberOfProviders(10, {from: accounts[1]}) );
    });

    it('should fail if new size is less than current size', async () => {
      await assertFail( pp.setMaxNumberOfProviders(6, {from: accounts[0]}) );
    });
  });

  describe('addProvider', () => {
    it('should add a provider to the pool', async () => {
      let providerPool = await pp.providerPool.call();
      assert.equal(0, providerPool[0]); // address head
      assert.equal(0, providerPool[1]); // address tail
      assert.equal(0, providerPool[3]); // size
      await pp.publicAddProvider(accounts[1], 10);
      providerPool = await pp.providerPool.call();
      assert.equal(accounts[1], providerPool[0]); // address head
      assert.equal(accounts[1], providerPool[1]); // address tail
      assert.equal(1, providerPool[3]); // size
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
      await pp.setMaxNumberOfProviders(10, {from: accounts[0]});
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
      await pp.setMaxNumberOfProviders(10, {from: accounts[0]});
      await pp.publicAddProvider(accounts[0], 1);
      await pp.publicAddProvider(accounts[1], 12);
      await pp.publicAddProvider(accounts[2], 3);
      await pp.publicAddProvider(accounts[3], 15);
      await pp.publicAddProvider(accounts[4], 8);
    });

    it('should update the new key', async () => {
      let provider = await pp.getProvider(accounts[0]);
      let totalBondedAmount = provider[0];
      assert.equal(1, totalBondedAmount);
      await pp.publicUpdateProvider(accounts[0], 9);
      provider = await pp.getProvider(accounts[0]);
      totalBondedAmount = provider[0];
      assert.equal(9, totalBondedAmount);
    });

    it('should keep the value sorted', async () => {
      await pp.publicUpdateProvider(accounts[1], 10);
      await assertProvidersAreSortedByBondedAmount();
    });

    it('should maintain the size of the pool constant', async () => {
      let providerPool = await pp.providerPool.call();
      const previousSize = providerPool[3].toNumber();
      await pp.publicUpdateProvider(accounts[2], 20);
      providerPool = await pp.providerPool.call();
      assert.equal(previousSize, providerPool[3]);
    });

    it('should remove the provider if updated totalBondedAmount is zero', async () => {
      let providerPool = await pp.providerPool.call();
      const previousSize = providerPool[3].toNumber();
      assert.equal(true, await pp.containsProvider(accounts[2]));
      await pp.publicUpdateProvider(accounts[2], 0);
      assert.equal(false, await pp.containsProvider(accounts[2]));
      providerPool = await pp.providerPool.call();
      assert.equal(previousSize - 1, providerPool[3]);
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
      let providerPool = await pp.providerPool.call();
      const previousSize = providerPool[3].toNumber();
      await pp.publicRemoveProvider(accounts[1]);
      providerPool = await pp.providerPool.call();
      assert.equal(previousSize - 1, providerPool[3]);
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

