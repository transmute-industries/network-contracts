// Here we use the TestProviderPool contract instead of the ProviderPool
// This is to be able to test the addProvider function which has internal visibility 
// through the publicAddProvider function from TestProviderPool which has public visibility
const ProviderPool = artifacts.require('./TestProviderPool.sol');
const { blockMiner, assertFail } = require('./utils.js');

contract('ProviderPool', accounts => {

  let pp;

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

    it("should fail if it is not called from the owner's address", async () => {
      await assertFail( pp.setMaxNumberOfProviders(10, {from: accounts[1]}) );
    });

    it("should fail if new size is less than current size", async () => {
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
      const assertProvidersAreSortedByBondedAmount = async () => {
        let bondedAmountOfPreviousAddress = Number.POSITIVE_INFINITY; 
        let previousAddress = 0;
        let providerPool = await pp.providerPool.call();
        let currentAddress = providerPool[0];
        let node = await pp.get.call(currentAddress);
        let end = providerPool[1];
        do {
          assert(node[0] <= bondedAmountOfPreviousAddress); //
          assert.equal(node[2], previousAddress);
          previousAddress = currentAddress;
          currentAddress = node[1];
          node = await pp.get.call(currentAddress);
        }
        while(currentAddress != end)
      }

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
});

