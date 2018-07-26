const TransmuteDPOS = artifacts.require('./TestTransmuteDPOS.sol');
const { blockMiner, assertFail, roundManagerHelper } = require('../utils.js');

contract('integration/TransmuteDPOS', accounts => {

  let tdpos;
  let contractAddress;
  const PROVIDER_POOL_SIZE = 4;

  // Provider states
  const PROVIDER_UNREGISTERED = 0;
  const PROVIDER_REGISTERED = 1;

  let provider1 = accounts[1];
  let provider2 = accounts[2];
  let provider3 = accounts[3];
  let provider4 = accounts[4];
  let provider5 = accounts[5];

  async function reset() {
    tdpos = await TransmuteDPOS.new();
    contractAddress = tdpos.address;
    for(let i = 0; i < 10; i++) {
      await tdpos.mint(accounts[i], 1000, {from: accounts[0]});
    }
    await tdpos.setMaxNumberOfProviders(PROVIDER_POOL_SIZE);
  }

  describe('Registering as Providers', () => {

    before(async () => {
      await reset();
    });

    it('provider1 delegates tokens to himself before calling provider()', async () => {
      await tdpos.approve(contractAddress, 100, {from: provider1});
      await tdpos.bond(provider1, 100, {from: provider1});
    });

    it('provider1 fails to register because initializeRound() was not called', async () => {
      await assertFail( tdpos.provider(22, 10, 1, 25, {from: provider1}) );
    });

    it('someone calls initializeRound()', async () => {
      const roundNumber = await tdpos.roundNumber.call();
      await tdpos.initializeRound();
      assert.deepEqual(roundNumber.add(1), await tdpos.roundNumber.call());
    });

    it('provider1 registers as Provider', async () => {
      assert.equal(PROVIDER_UNREGISTERED, await tdpos.providerStatus(provider1));
      await tdpos.provider(22, 10, 1, 25, {from: provider1});
      assert.equal(PROVIDER_REGISTERED, await tdpos.providerStatus(provider1));
    });

    it('someone calls initializeRound again but it fails because election period of current round is not over', async () => {
      await assertFail( tdpos.initializeRound() );
    });

    it("provider2 fails to register because he didn't delegate tokens to himself", async () => {
      await assertFail( tdpos.provider(22, 10, 1, 25, {from: provider2}) );
    });

    it('provider2 delegates tokens to himself', async () => {
      await tdpos.approve(contractAddress, 200, {from: provider2});
      await tdpos.bond(provider2, 200, {from: provider2});
    });

    it('provider2 registers as Provider', async () => {
      assert.equal(PROVIDER_UNREGISTERED, await tdpos.providerStatus(provider2));
      await tdpos.provider(22, 10, 1, 25, {from: provider2});
      assert.equal(PROVIDER_REGISTERED, await tdpos.providerStatus(provider2));
    });

    it('provider3 delegates tokens to himself', async () => {
      await tdpos.approve(contractAddress, 300, {from: provider3});
      await tdpos.bond(provider3, 300, {from: provider3});
    });

    it('provider3 fails to register with invalid parameters', async () => {
      // Cannot have negative blockRewardCut
      await assertFail( tdpos.provider(22, 10, -1, 25, {from: provider3}) );
      // Cannot have over 100% of feeShare
      await assertFail( tdpos.provider(22, 10, 1, 125, {from: provider3}) );
    });

    it('provider3 registers as Provider with valid parameters', async () => {
      assert.equal(PROVIDER_UNREGISTERED, await tdpos.providerStatus(provider3));
      await tdpos.provider(22, 10, 1, 25, {from: provider3});
      assert.equal(PROVIDER_REGISTERED, await tdpos.providerStatus(provider3));
    });

    it('provider4 delegates tokens to himself', async () => {
      await tdpos.approve(contractAddress, 400, {from: provider4});
      await tdpos.bond(provider4, 400, {from: provider4});
    });

    it('provider4 fails to register because rateLockDeadline has passed for the current round', async () => {
      const rateLockDeadlineBlock = await roundManagerHelper.getRateLockDeadlineBlock(tdpos);
      await blockMiner.mineUntilBlock(rateLockDeadlineBlock);
      await assertFail( tdpos.provider(22, 10, 1, 25, {from: provider4}) );
    });

    it('someone calls initializeRound() but it fails because Election Period is not over', async () => {
      await assertFail( tdpos.initializeRound() );
    });

    it('someone calls initializeRound() after Election Period is over', async () => {
      const electionPeriodEndBlock = await roundManagerHelper.getElectionPeriodEndBlock(tdpos);
      await blockMiner.mineUntilBlock(electionPeriodEndBlock);
      const roundNumber = await tdpos.roundNumber.call();
      await tdpos.initializeRound();
      assert.deepEqual(roundNumber.add(1), await tdpos.roundNumber.call());
    });

    it('provider4 registers as Provider in the new round', async () => {
      assert.equal(PROVIDER_UNREGISTERED, await tdpos.providerStatus(provider4));
      await tdpos.provider(22, 10, 1, 25, {from: provider4});
      assert.equal(PROVIDER_REGISTERED, await tdpos.providerStatus(provider4));
    });

    it('provider5 delegates tokens to himself', async () => {
      await tdpos.approve(contractAddress, 500, {from: provider5});
      await tdpos.bond(provider5, 500, {from: provider5});
    });

    it('provider5 registers as Provider but fails because the providerPool is at maximum capacity', async () => {
      const providerPool = await tdpos.providerPool.call();
      let maxSize = providerPool[2];
      let size = providerPool[3];
      assert.deepEqual(maxSize, size);
      await assertFail( tdpos.provider(22, 10, 1, 25, {from: provider5}) );
    });
  });
});
