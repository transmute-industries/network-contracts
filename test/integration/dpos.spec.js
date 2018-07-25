const TransmuteDPOS = artifacts.require('./TestTransmuteDPOS.sol');
const { blockMiner, assertFail } = require('../utils.js');

contract('integration/TransmuteDPOS', accounts => {

  let tdpos;
  let contractAddress;
  const PROVIDER_POOL_SIZE = 5;
  // Provider states
  const PROVIDER_UNREGISTERED = 0;
  const PROVIDER_REGISTERED = 1;

  // Delegator states
  const DELEGATOR_UNBONDED = 0;
  const DELEGATOR_UNBONDED_WITH_TOKENS_TO_WITHDRAW = 1;
  const DELEGATOR_BONDED = 2;

  let provider1 = accounts[1];
  let provider2 = accounts[2];
  let provider3 = accounts[3];
  let delegator1 = accounts[5];
  let delegator2 = accounts[6];
  let delegator3 = accounts[7];

  // This is a convenience function for the process of registering a new provider.
  // Step 1: Approve the transfer of amountBonded tokens (ERC20 spec)
  // Step 2: Bond the amount to the provider
  // Step 3: Registering parameters with provider()
  async function registerProvider(pricePerStorageMineral, pricePerComputeMineral, blockRewardCut, feeShare, amountBonded, provider) {
      // This approve function comes from the ERC20 Transmute Token contract
      await tdpos.approve(contractAddress, amountBonded, {from: provider});
      await tdpos.bond(provider, amountBonded, {from: provider});
      await tdpos.provider(pricePerStorageMineral, pricePerComputeMineral, blockRewardCut, feeShare, {from: provider});
  }

  async function reset() {
    tdpos = await TransmuteDPOS.new();
    contractAddress = tdpos.address;
    await distributeTokens();
    await tdpos.setMaxNumberOfProviders(PROVIDER_POOL_SIZE);
  }

  async function distributeTokens() {
    for(let i = 0; i < 10; i++) {
      await tdpos.mint(accounts[i], 1000, {from: accounts[0]});
    }
  }

  describe('Registering as Providers', () => {

    before(async () => {
      await reset();
    });

    it('Provider cannot register until initializeRound() is called', async () => {
      await assertFail( registerProvider(22, 10, 1, 25, 42, provider1) );
    });
  });
});

