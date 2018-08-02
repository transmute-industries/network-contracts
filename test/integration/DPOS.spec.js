const TransmuteDPOS = artifacts.require('./TestTransmuteDPOS.sol');
const {blockMiner, assertFail, roundManagerHelper} = require('../utils.js');

contract('integration/TransmuteDPOS', (accounts) => {
  let tdpos;
  let contractAddress;
  const PROVIDER_POOL_SIZE = 4;
  const NUMBER_OF_ACTIVE_PROVIDERS = 4;

  // Provider states
  const PROVIDER_UNREGISTERED = 0;
  const PROVIDER_REGISTERED = 1;

  // Provider parameters
  const PRICE_PER_STORAGE_MINERAL = 22;
  const PRICE_PER_COMPUTE_MINERAL = 10;
  const BLOCK_REWARD_CUT = 1;
  const FEE_SHARE = 25;
  const STANDARD_PROVIDER_PARAMETERS = [PRICE_PER_STORAGE_MINERAL, PRICE_PER_COMPUTE_MINERAL, BLOCK_REWARD_CUT, FEE_SHARE];

  // Delegator states
  const DELEGATOR_UNBONDED = 0;
  const DELEGATOR_UNBONDED_WITH_TOKENS_TO_WITHDRAW = 1;
  const DELEGATOR_BONDED = 2;

  let provider1; let provider2; let provider3; let provider4; let provider5;
  let delegator1; let delegator2; let delegator3; let delegator4; let delegator5;

  async function reset() {
    tdpos = await TransmuteDPOS.new();
    contractAddress = tdpos.address;
    for (let i = 0; i < 10; i++) {
      await tdpos.mint(accounts[i], 1000, {from: accounts[0]});
    }
    await tdpos.setProviderPoolMaxSize(PROVIDER_POOL_SIZE);
    await tdpos.setNumberOfActiveProviders(NUMBER_OF_ACTIVE_PROVIDERS);
  }

  describe('Registering as Providers', () => {
    before(async () => {
      await reset();
      // Make sure that block.number > electionPeriodLength otherwise some tests containing initializeRound might fail
      // it is ok to do this because in the main network block.number >> 100
      await blockMiner.mine(100);
      provider1 = accounts[1];
      provider2 = accounts[2];
      provider3 = accounts[3];
      provider4 = accounts[4];
      provider5 = accounts[5];
    });

    it('provider1 delegates tokens to himself before calling provider()', async () => {
      await tdpos.approve(contractAddress, 100, {from: provider1});
      await tdpos.bond(provider1, 100, {from: provider1});
    });

    it('provider1 fails to register because initializeRound() was not called', async () => {
      await assertFail( tdpos.provider(...STANDARD_PROVIDER_PARAMETERS, {from: provider1}) );
    });

    it('someone calls initializeRound()', async () => {
      const roundNumber = await tdpos.roundNumber.call();
      await tdpos.initializeRound();
      assert.deepEqual(roundNumber.add(1), await tdpos.roundNumber.call());
    });

    it('provider1 registers as Provider', async () => {
      assert.equal(PROVIDER_UNREGISTERED, await tdpos.providerStatus(provider1));
      await tdpos.provider(...STANDARD_PROVIDER_PARAMETERS, {from: provider1});
      assert.equal(PROVIDER_REGISTERED, await tdpos.providerStatus(provider1));
    });

    it('someone calls initializeRound again but it fails because election period of current round is not over', async () => {
      await assertFail( tdpos.initializeRound() );
    });

    it('provider2 fails to register because he didn\'t delegate tokens to himself', async () => {
      await assertFail( tdpos.provider(...STANDARD_PROVIDER_PARAMETERS, {from: provider2}) );
    });

    it('provider2 delegates tokens to himself', async () => {
      await tdpos.approve(contractAddress, 200, {from: provider2});
      await tdpos.bond(provider2, 200, {from: provider2});
    });

    it('provider2 registers as Provider', async () => {
      assert.equal(PROVIDER_UNREGISTERED, await tdpos.providerStatus(provider2));
      await tdpos.provider(...STANDARD_PROVIDER_PARAMETERS, {from: provider2});
      assert.equal(PROVIDER_REGISTERED, await tdpos.providerStatus(provider2));
    });

    it('provider3 delegates tokens to himself', async () => {
      await tdpos.approve(contractAddress, 300, {from: provider3});
      await tdpos.bond(provider3, 300, {from: provider3});
    });

    it('provider3 fails to register with invalid parameters', async () => {
      const INVALID_BLOCK_REWARD_CUT = -1;
      await assertFail( tdpos.provider(PRICE_PER_STORAGE_MINERAL, PRICE_PER_COMPUTE_MINERAL, INVALID_BLOCK_REWARD_CUT, FEE_SHARE, {from: provider3}) );
      const INVALID_FEE_SHARE = 125;
      await assertFail( tdpos.provider(PRICE_PER_STORAGE_MINERAL, PRICE_PER_COMPUTE_MINERAL, BLOCK_REWARD_CUT, INVALID_FEE_SHARE, {from: provider3}) );
    });

    it('provider3 registers as Provider with valid parameters', async () => {
      assert.equal(PROVIDER_UNREGISTERED, await tdpos.providerStatus(provider3));
      await tdpos.provider(...STANDARD_PROVIDER_PARAMETERS, {from: provider3});
      assert.equal(PROVIDER_REGISTERED, await tdpos.providerStatus(provider3));
    });

    it('provider4 delegates tokens to himself', async () => {
      await tdpos.approve(contractAddress, 400, {from: provider4});
      await tdpos.bond(provider4, 400, {from: provider4});
    });

    it('provider4 fails to register because rateLockDeadline has passed for the current round', async () => {
      const rateLockDeadlineBlock = await roundManagerHelper.getRateLockDeadlineBlock(tdpos);
      await blockMiner.mineUntilBlock(rateLockDeadlineBlock);
      await assertFail( tdpos.provider(...STANDARD_PROVIDER_PARAMETERS, {from: provider4}) );
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
      await tdpos.provider(...STANDARD_PROVIDER_PARAMETERS, {from: provider4});
      assert.equal(PROVIDER_REGISTERED, await tdpos.providerStatus(provider4));
    });

    it('provider5 delegates tokens to himself', async () => {
      await tdpos.approve(contractAddress, 500, {from: provider5});
      await tdpos.bond(provider5, 500, {from: provider5});
    });

    it('provider5 registers as Provider but fails because the providerPool is at maximum capacity', async () => {
      const maxSize = await tdpos.getProviderPoolMaxSize.call();
      const size = await tdpos.getProviderPoolSize.call();
      assert.deepEqual(maxSize, size);
      await assertFail( tdpos.provider(...STANDARD_PROVIDER_PARAMETERS, {from: provider5}) );
    });
  });


  describe('Bonding tokens', () => {
    before(async () => {
      await reset();
      provider1 = accounts[1];
      provider2 = accounts[2];
      delegator1 = accounts[3];
      delegator2 = accounts[4];
      delegator3 = accounts[5];
      delegator4 = accounts[6];
      await tdpos.initializeRound();
      // Register provider1
      await tdpos.approve(contractAddress, 100, {from: provider1});
      await tdpos.bond(provider1, 100, {from: provider1});
      await tdpos.provider(...STANDARD_PROVIDER_PARAMETERS, {from: provider1});
      // Register provider2
      await tdpos.approve(contractAddress, 200, {from: provider2});
      await tdpos.bond(provider2, 200, {from: provider2});
      await tdpos.provider(...STANDARD_PROVIDER_PARAMETERS, {from: provider2});
    });

    it('delegator1 fails to delegate his tokens to provider1 because he didn\'t approve the transfer first', async () => {
      await assertFail( tdpos.bond(provider1, 100, {from: delegator1}) );
    });

    it('delegator1 approves the transfer of his tokens', async () => {
      await tdpos.approve(contractAddress, 100, {from: delegator1});
    });

    it('delegator1 delegates his tokens to provider1', async () => {
      await tdpos.bond(provider1, 100, {from: delegator1});
    });

    it('delegator2 fails to delegate to provider1 because amount delegated is zero', async () => {
      await tdpos.approve(contractAddress, 100, {from: delegator2});
      await assertFail( tdpos.bond(provider1, 0, {from: delegator2}) );
    });

    it('delegator2 delegates non zero amount of tokens to provider1', async () => {
      await tdpos.bond(provider1, 100, {from: delegator2});
    });

    it('delegator3 fails to delegate to provider3 because provider3 is not a Registered Provider', async () => {
      await tdpos.approve(contractAddress, 100, {from: delegator3});
      await assertFail( tdpos.bond(provider3, 100, {from: delegator3}) );
    });

    it('delegator3 delegates to provider2', async () => {
      await tdpos.bond(provider2, 100, {from: delegator3});
    });

    it('delegator4 delegates to himself', async () => {
      await tdpos.approve(contractAddress, 100, {from: delegator4});
      await tdpos.bond(delegator4, 100, {from: delegator4});
    });
  });

  describe('Unbonding tokens', () => {
    before(async () => {
      delegator5 = accounts[7];
    });

    it('delegator1 unbonds and enters the UNBONDED_WITH_TOKENS_TO_WITHDRAW state', async () => {
      assert.equal(DELEGATOR_BONDED, await tdpos.delegatorStatus(delegator1));
      await tdpos.unbond({from: delegator1});
      assert.equal(DELEGATOR_UNBONDED_WITH_TOKENS_TO_WITHDRAW, await tdpos.delegatorStatus(delegator1));
    });

    it('delegator1 unbonds again but fails because he is in the UNBONDED_WITH_TOKENS_TO_WITHDRAW state', async () => {
      assert.equal(DELEGATOR_UNBONDED_WITH_TOKENS_TO_WITHDRAW, await tdpos.delegatorStatus(delegator1));
      await assertFail( tdpos.unbond({from: delegator1}) );
    });

    it('provider1 unbonds and as a result looses his Provider status', async () => {
      assert.equal(PROVIDER_REGISTERED, await tdpos.providerStatus(provider1));
      await tdpos.unbond({from: provider1});
      assert.equal(PROVIDER_UNREGISTERED, await tdpos.providerStatus(provider1));
    });

    it('delegator5 unbonds but fails because he is in the UNBONDED state', async () => {
      assert.equal(DELEGATOR_UNBONDED, await tdpos.delegatorStatus(delegator5));
      await assertFail( tdpos.unbond({from: delegator5}) );
    });
  });

  describe('Withdrawing tokens', () => {
    it('delegator1 withdraws and fails because he didn\'t wait the unbondingPeriod', async () => {
      assert.equal(DELEGATOR_UNBONDED_WITH_TOKENS_TO_WITHDRAW, await tdpos.delegatorStatus(delegator1));
      await assertFail( tdpos.withdraw({from: delegator1}) );
    });

    it('delegator1 waits the unbondingPeriod and withdraws his tokens', async () => {
      const unbondingInformation = await tdpos.unbondingInformations.call(delegator1);
      const withdrawBlock = unbondingInformation[0];
      await blockMiner.mineUntilBlock(withdrawBlock);
      await tdpos.withdraw({from: delegator1});
      assert.equal(DELEGATOR_UNBONDED, await tdpos.delegatorStatus(delegator1));
    });

    it('provider1 withdraws his tokens and enters UNBONDED state', async () => {
      assert.equal(DELEGATOR_UNBONDED_WITH_TOKENS_TO_WITHDRAW, await tdpos.delegatorStatus(provider1));
      await tdpos.withdraw({from: provider1});
      assert.equal(DELEGATOR_UNBONDED, await tdpos.delegatorStatus(provider1));
    });

    it('delegator4 withdraws but fails because he is in the BONDED state', async () => {
      assert.equal(DELEGATOR_BONDED, await tdpos.delegatorStatus(delegator4));
      await assertFail( tdpos.withdraw({from: delegator4}) );
    });
  });
});

