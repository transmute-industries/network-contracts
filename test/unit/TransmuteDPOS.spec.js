const TransmuteDPOS = artifacts.require('./TestTransmuteDPOS.sol');
const {blockMiner, assertFail, roundManagerHelper} = require('../utils.js');
require('truffle-test-utils').init();

contract('TransmuteDPOS', (accounts) => {
  let tdpos;
  let contractAddress;
  const PROVIDER_POOL_SIZE = 5;
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
  const DELEGATOR_UNBONDING = 1;
  const DELEGATOR_BONDED = 2;

  // This is a convenience function for the process of registering a new provider.
  // Step 1: Approve the transfer of amountBonded tokens (ERC20 spec)
  // Step 2: Bond the amount to the provider
  // Step 3: Registering parameters with provider()
  async function approveBondProvider(pricePerStorageMineral, pricePerComputeMineral, blockRewardCut, feeShare, amountBonded, provider) {
      // This approve function comes from the ERC20 Transmute Token contract
      await tdpos.approve(contractAddress, amountBonded, {from: provider});
      await tdpos.bond(provider, amountBonded, {from: provider});
      await tdpos.provider(pricePerStorageMineral, pricePerComputeMineral, blockRewardCut, feeShare, {from: provider});
  }

  async function initNew() {
    tdpos = await TransmuteDPOS.new();
    contractAddress = tdpos.address;
    for (let i = 0; i < 10; i++) {
      await tdpos.mint(accounts[i], 1000, {from: accounts[0]});
    }
    await tdpos.setProviderPoolMaxSize(PROVIDER_POOL_SIZE);
    await tdpos.setNumberOfActiveProviders(NUMBER_OF_ACTIVE_PROVIDERS);
    const electionPeriodEndBlock = await roundManagerHelper.getElectionPeriodEndBlock(tdpos);
    await blockMiner.mineUntilBlock(electionPeriodEndBlock);
    await tdpos.initializeRound();
  }

  describe('provider', () => {
    before(async () => {
      tdpos = await TransmuteDPOS.deployed();
      contractAddress = tdpos.address;
      for (let i = 0; i < 5; i++) {
        await tdpos.mint(accounts[i], 1000, {from: accounts[0]});
      }
      await tdpos.setProviderPoolMaxSize(PROVIDER_POOL_SIZE);
      await tdpos.setNumberOfActiveProviders(NUMBER_OF_ACTIVE_PROVIDERS);
    });

    beforeEach(async () => {
      const electionPeriodEndBlock = await roundManagerHelper.getElectionPeriodEndBlock(tdpos);
      await blockMiner.mineUntilBlock(electionPeriodEndBlock);
      await tdpos.initializeRound();
    });

    it('should fail if the Provider does not bond some tokens on himself first', async () => {
      await assertFail( tdpos.provider(...STANDARD_PROVIDER_PARAMETERS, {from: accounts[0]}) );
    });

    it('should initially set providerStake to the amount the Provider bonded to himself', async () => {
      let providerStake = await tdpos.getProviderStake.call(accounts[0]);
      assert.equal(0, providerStake);
      await approveBondProvider(...STANDARD_PROVIDER_PARAMETERS, 42, accounts[0]);
      providerStake = await tdpos.getProviderStake.call(accounts[0]);
      assert.equal(42, providerStake);
    });

    it('should register a Provider\'s parameters', async () => {
      assert.equal(PROVIDER_UNREGISTERED, await tdpos.providerStatus.call(accounts[1]));
      await approveBondProvider(...STANDARD_PROVIDER_PARAMETERS, 1, accounts[1]);
      const provider = await tdpos.providers.call(accounts[1]);
      let [pricePerStorageMineral, pricePerComputeMineral,
        blockRewardCut, feeShare] = provider;
      assert.equal(PROVIDER_REGISTERED, await tdpos.providerStatus.call(accounts[1]));
      assert.equal(PRICE_PER_STORAGE_MINERAL, pricePerStorageMineral);
      assert.equal(PRICE_PER_COMPUTE_MINERAL, pricePerComputeMineral);
      assert.equal(BLOCK_REWARD_CUT, blockRewardCut);
      assert.equal(FEE_SHARE, feeShare);
    });

    it('should fail with invalid parameters', async () => {
      const INVALID_BLOCK_REWARD_CUT = -1;
      await assertFail( approveBondProvider(PRICE_PER_STORAGE_MINERAL, PRICE_PER_COMPUTE_MINERAL, INVALID_BLOCK_REWARD_CUT, FEE_SHARE, 1, accounts[2]) );
      const INVALID_FEE_SHARE = 125;
      await assertFail( tdpos.provider(PRICE_PER_STORAGE_MINERAL, PRICE_PER_COMPUTE_MINERAL, BLOCK_REWARD_CUT, INVALID_FEE_SHARE, {from: accounts[2]}) );
    });

    it('should fail if not called during an active round', async () => {
      const electionPeriodEndBlock = await roundManagerHelper.getElectionPeriodEndBlock(tdpos);
      await blockMiner.mineUntilBlock(electionPeriodEndBlock);
      await assertFail( tdpos.provider(...STANDARD_PROVIDER_PARAMETERS, {from: accounts[0]}) );
    });

    it('should work if called before the lock period of an active round', async () => {
      const rateLockDeadlineBlock = await roundManagerHelper.getRateLockDeadlineBlock(tdpos);
      // One block before lock deadline
      await blockMiner.mineUntilBlock(rateLockDeadlineBlock - 1);
      const UPDATED_PRICE_PER_STORAGE_MINERAL = 23;
      await tdpos.provider(UPDATED_PRICE_PER_STORAGE_MINERAL, PRICE_PER_COMPUTE_MINERAL, BLOCK_REWARD_CUT, FEE_SHARE, {from: accounts[0]});
      const provider = await tdpos.providers(accounts[0]);
      const pricePerStorageMineral = provider[0];
      assert.equal(UPDATED_PRICE_PER_STORAGE_MINERAL, pricePerStorageMineral);
    });

    it('should fail during the lock period of an active round', async () => {
      const rateLockDeadlineBlock = await roundManagerHelper.getRateLockDeadlineBlock(tdpos);
      // lock deadline block
      await blockMiner.mineUntilBlock(rateLockDeadlineBlock);
      await assertFail( tdpos.provider(...STANDARD_PROVIDER_PARAMETERS, {from: accounts[0]}) );
    });

    it('should send a ProviderAdded event for a new Provider', async () => {
      const result = await tdpos.provider(...STANDARD_PROVIDER_PARAMETERS, {from: accounts[2]});
      assert.web3Event(result, {
        event: 'ProviderAdded',
        args: {
          provider: accounts[2],
          pricePerStorageMineral: PRICE_PER_STORAGE_MINERAL,
          pricePerComputeMineral: PRICE_PER_COMPUTE_MINERAL,
          blockRewardCut: BLOCK_REWARD_CUT,
          feeShare: FEE_SHARE,
        },
      });
    });

    it('should send a ProviderUpdated event for an existing Provider', async () => {
      const UPDATED_PRICE_PER_STORAGE_MINERAL = 21;
      const UPDATED_PRICE_PER_COMPUTE_MINERAL = 11;
      const UPDATED_BLOCK_REWARD_CUT = 2;
      const UPDATED_FEE_SHARE = 24;
      const result = await tdpos.provider(UPDATED_PRICE_PER_STORAGE_MINERAL, UPDATED_PRICE_PER_COMPUTE_MINERAL, UPDATED_BLOCK_REWARD_CUT, UPDATED_FEE_SHARE, {from: accounts[2]});
      assert.web3Event(result, {
        event: 'ProviderUpdated',
        args: {
          provider: accounts[2],
          pricePerStorageMineral: UPDATED_PRICE_PER_STORAGE_MINERAL,
          pricePerComputeMineral: UPDATED_PRICE_PER_COMPUTE_MINERAL,
          blockRewardCut: UPDATED_BLOCK_REWARD_CUT,
          feeShare: UPDATED_FEE_SHARE,
        },
      });
    });

    it('should add the Provider to the pool if he is Unregistered and size < maxSize', async () => {
      // Check that provider isn't registered yet
      assert.equal(PROVIDER_UNREGISTERED, await tdpos.providerStatus.call(accounts[3]));
      // Check the size of the pool increases by 1
      const previousSize = await tdpos.getProviderPoolSize();
      await approveBondProvider(...STANDARD_PROVIDER_PARAMETERS, 1, accounts[3]);
      assert.deepEqual(previousSize.add(1), await tdpos.getProviderPoolSize());
      // Check that the provider is registered in the pool now
      assert.equal(true, await tdpos.containsProvider(accounts[3]));
    });

    it('should fail if Provider is Unregistered and size == maxSize', async () => {
      const maxSize = await tdpos.getProviderPoolMaxSize();
      let currentSize = await tdpos.getProviderPoolSize();
      assert.isAbove(maxSize.toNumber(), currentSize.toNumber());
      await approveBondProvider(...STANDARD_PROVIDER_PARAMETERS, 1, accounts[4]);
      currentSize = await tdpos.getProviderPoolSize();
      assert.deepEqual(maxSize, currentSize);
      await assertFail( approveBondProvider(...STANDARD_PROVIDER_PARAMETERS, 1, accounts[5]) );
    });

    it('should work if Provider is Registered and size == maxSize', async () => {
      let provider = await tdpos.providers.call(accounts[4]);
      pricePerStorageMineral = provider[0];
      assert.equal(PRICE_PER_STORAGE_MINERAL, pricePerStorageMineral);
      const UPDATED_PRICE_PER_STORAGE_MINERAL = 21;
      await tdpos.provider(UPDATED_PRICE_PER_STORAGE_MINERAL, PRICE_PER_COMPUTE_MINERAL, BLOCK_REWARD_CUT, FEE_SHARE, {from: accounts[4]});
      provider = await tdpos.providers.call(accounts[4]);
      pricePerStorageMineral = provider[0];
      assert.equal(UPDATED_PRICE_PER_STORAGE_MINERAL, pricePerStorageMineral);
    });
  });

  describe('resignAsProvider', () => {
    before(async () => {
      await initNew();
      await approveBondProvider(...STANDARD_PROVIDER_PARAMETERS, 1, accounts[0]);
      await approveBondProvider(...STANDARD_PROVIDER_PARAMETERS, 1, accounts[1]);
      await approveBondProvider(...STANDARD_PROVIDER_PARAMETERS, 1, accounts[2]);
    });

    it('should remove the Provider from the provider mapping', async () => {
      let providerStatus = await tdpos.providerStatus.call(accounts[0]);
      assert.equal(PROVIDER_REGISTERED, providerStatus);
      await tdpos.publicResignAsProvider(accounts[0]);
      const resignedProvider = await tdpos.providers.call(accounts[0]);
      let [pricePerStorageMineral, pricePerComputeMineral,
        blockRewardCut, feeShare] = resignedProvider;
      providerStatus = await tdpos.providerStatus.call(accounts[0]);
      assert.equal(PROVIDER_UNREGISTERED, providerStatus);
      assert.equal(0, pricePerStorageMineral);
      assert.equal(0, pricePerComputeMineral);
      assert.equal(0, blockRewardCut);
      assert.equal(0, feeShare);
    });

    it('should remove the Provider from the providerPool', async () => {
      assert.equal(true, await tdpos.containsProvider(accounts[1]));
      await tdpos.publicResignAsProvider(accounts[1]);
      assert.equal(false, await tdpos.containsProvider(accounts[1]));
    });

    it('should send a ProviderResigned event', async () => {
      const result = await tdpos.publicResignAsProvider(accounts[2]);
      assert.web3Event(result, {
        event: 'ProviderResigned',
        args: {
          provider: accounts[2],
        },
      });
    });

    it('should fail if the transaction\'s sender is not a Provider', async () => {
      await assertFail( tdpos.publicResignAsProvider(accounts[3]) );
    });
  });

  describe('bond', () => {
    before(async () => {
      await initNew();
      await approveBondProvider(...STANDARD_PROVIDER_PARAMETERS, 1, accounts[0]);
      await approveBondProvider(...STANDARD_PROVIDER_PARAMETERS, 1, accounts[1]);
    });

    it('should fail if the Delegator does not approve to transfer at least the bonded amount', async () => {
      await assertFail( tdpos.bond(accounts[0], 10, {from: accounts[5]}) );
      await tdpos.approve(contractAddress, 9, {from: accounts[5]});
      await assertFail( tdpos.bond(accounts[0], 10, {from: accounts[5]}) );
    });

    it('should add a Delegator to the delegators list', async () => {
      await tdpos.approve(contractAddress, 10, {from: accounts[5]});
      await tdpos.bond(accounts[0], 10, {from: accounts[5]});
      const firstDelegator = await tdpos.delegators.call(accounts[5]);
      let [delegateAddress, amountBonded] = firstDelegator;
      assert.equal(accounts[0], delegateAddress);
      assert.equal(10, amountBonded);
    });

    it('should fail if amount is zero', async () => {
      await tdpos.approve(contractAddress, 20, {from: accounts[6]});
      await assertFail( tdpos.bond(accounts[0], 0, {from: accounts[6]}) );
    });

    it('should increase the providerStake of the Provider', async () => {
      const previousProviderStake = await tdpos.getProviderStake.call(accounts[0]);
      await tdpos.bond(accounts[0], 20, {from: accounts[6]});
      const newProviderStake = await tdpos.getProviderStake.call(accounts[0]);
      assert.deepEqual(previousProviderStake.add(20), newProviderStake);
    });

    it('should fail if the address is not a registered Provider address', async () => {
      await tdpos.approve(contractAddress, 15, {from: accounts[7]});
      await assertFail( tdpos.bond(accounts[2], 15, {from: accounts[7]}) );
    });

    it('should work if the address is not a registered Provider address but the address is the sender address', async () => {
      await tdpos.approve(contractAddress, 15, {from: accounts[3]});
      await tdpos.bond(accounts[3], 15, {from: accounts[3]});
    });

    it('should fail if called twice by the same Delegator', async () => {
      await tdpos.approve(contractAddress, 40, {from: accounts[8]});
      await tdpos.bond(accounts[1], 20, {from: accounts[8]});
      await assertFail( tdpos.bond(accounts[1], 20, {from: accounts[8]}) );
    });

    it('should fail if TST balance is less than bonded amount', async () => {
      await tdpos.approve(contractAddress, 1001, {from: accounts[9]});
      await assertFail( tdpos.bond(accounts[1], 1001, {from: accounts[9]}) );
      const providerStake = await tdpos.getProviderStake.call(accounts[6]);
      assert(1001 >= providerStake);
    });

    it('should transfer amount from the Delegator\'s balance to the contract\'s balance', async () => {
      const contractBalance = (await tdpos.balanceOf(tdpos.address)).toNumber();
      assert.equal(1000, await tdpos.balanceOf(accounts[9]));
      await tdpos.bond(accounts[1], 300, {from: accounts[9]});
      assert.equal(700, await tdpos.balanceOf(accounts[9]));
      assert.equal(contractBalance + 300, await tdpos.balanceOf(tdpos.address));
    });

    it('should not affect the providerPool if Provider is not registered', async () => {
      assert.equal(false, await tdpos.containsProvider(accounts[2]));
      await tdpos.approve(contractAddress, 300, {from: accounts[2]});
      await tdpos.bond(accounts[2], 300, {from: accounts[2]});
      assert.equal(false, await tdpos.containsProvider(accounts[2]));
    });

    it('should update the providerStake of the Provider if he is already registered', async () => {
      const previousProviderStake = await tdpos.getProviderStake.call(accounts[0]);
      await tdpos.approve(contractAddress, 300, {from: accounts[7]});
      await tdpos.bond(accounts[0], 300, {from: accounts[7]});
      const newProviderStake = await tdpos.getProviderStake.call(accounts[0]);
      assert.deepEqual(previousProviderStake.add(300), newProviderStake);
    });

    it('should emit the DelegateBonded event', async () => {
      const bondedAmount = 300;
      await tdpos.approve(contractAddress, bondedAmount, {from: accounts[4]});
      const result = await tdpos.bond(accounts[0], bondedAmount, {from: accounts[4]});
      assert.web3Event(result, {
        event: 'DelegatorBonded',
        args: {
          delegator: accounts[4],
          provider: accounts[0],
          amount: bondedAmount,
        },
      });
    });
  });

  describe('unbond', () => {
    before(async () => {
      await initNew();
      await approveBondProvider(...STANDARD_PROVIDER_PARAMETERS, 1, accounts[0]);
      await approveBondProvider(...STANDARD_PROVIDER_PARAMETERS, 1, accounts[1]);
      await tdpos.approve(contractAddress, 300, {from: accounts[2]});
      await tdpos.bond(accounts[0], 300, {from: accounts[2]});
      await tdpos.approve(contractAddress, 300, {from: accounts[3]});
      await tdpos.bond(accounts[0], 300, {from: accounts[3]});
      await tdpos.approve(contractAddress, 300, {from: accounts[4]});
      await tdpos.bond(accounts[0], 300, {from: accounts[4]});
      await tdpos.approve(contractAddress, 300, {from: accounts[5]});
      await tdpos.bond(accounts[0], 300, {from: accounts[5]});
      await tdpos.approve(contractAddress, 300, {from: accounts[6]});
      await tdpos.bond(accounts[6], 300, {from: accounts[6]});
    });

    it('should fail if called by an address that is not a Delegator (no bonded amount)', async () => {
      assert.equal(DELEGATOR_UNBONDED, await tdpos.delegatorStatus(accounts[9]));
      await assertFail( tdpos.unbond({from: accounts[9]}) );
    });

    it('should set unbondingInformation for the Delegator\'s address', async () => {
      let unbondingInformation = await tdpos.unbondingInformations.call(accounts[2]);
      let withdrawBlock = unbondingInformation[0];
      assert.equal(0, withdrawBlock);
      await tdpos.unbond({from: accounts[2]});
      const currentBlockNumber = web3.eth.blockNumber;
      const unbondingPeriod = (await tdpos.unbondingPeriod.call()).toNumber();
      unbondingInformation = await tdpos.unbondingInformations.call(accounts[2]);
      withdrawBlock = unbondingInformation[0];
      assert.equal(currentBlockNumber + unbondingPeriod, withdrawBlock);
    });

    it('should decrease the providerStake of the Provider by the unbonded amount', async () => {
      const previousProviderStake = await tdpos.getProviderStake.call(accounts[0]);
      const bondedAmount = (await tdpos.delegators(accounts[3]))[1];
      await tdpos.unbond({from: accounts[3]});
      const newProviderStake = await tdpos.getProviderStake.call(accounts[0]);
      assert.deepEqual(previousProviderStake.sub(bondedAmount), newProviderStake);
    });

    it('should resign the Provider if a Provider calls the function', async () => {
      assert.equal(PROVIDER_REGISTERED, await tdpos.providerStatus.call(accounts[1]));
      await tdpos.unbond({from: accounts[1]});
      assert.equal(PROVIDER_UNREGISTERED, await tdpos.providerStatus.call(accounts[1]));
    });

    it('should work if Delegator bonded to himself', async () => {
      const delegator = await tdpos.delegators.call(accounts[6]);
      const delegateAddress = delegator[0];
      assert.equal(delegateAddress, accounts[6]);
      await tdpos.unbond({from: accounts[6]});
    });

    it('should remove the Delegator from the mapping', async () => {
      let delegator = await tdpos.delegators.call(accounts[4]);
      let [delegateAddress, amountBonded] = delegator;
      assert.notEqual(0, delegateAddress);
      assert.notEqual(0, amountBonded);
      await tdpos.unbond({from: accounts[4]});
      delegator = await tdpos.delegators.call(accounts[4]);
      [delegateAddress, amountBonded] = delegator;
      assert.equal(0, delegateAddress);
      assert.equal(0, amountBonded);
    });

    it('should emit the DelegateUnbonded event', async () => {
      const delegator = await tdpos.delegators.call(accounts[5]);
      let [delegateAddress, amountBonded] = delegator;
      assert.equal(accounts[0], delegateAddress);
      assert.equal(300, amountBonded);
      const result = await tdpos.unbond({from: accounts[5]});
      assert.web3Event(result, {
        event: 'DelegatorUnbonded',
        args: {
          delegator: accounts[5],
          provider: accounts[0],
          amount: 300,
        },
      });
    });
  });

  describe('delegatorStatus', () => {
    before(async () => {
      await initNew();
      await approveBondProvider(...STANDARD_PROVIDER_PARAMETERS, 1, accounts[0]);
    });

    it('should return Unbonded if address is not a Delegator', async () => {
      // Assert that address is not a delegator
      const delegator = await tdpos.delegators.call(accounts[3]);
      let [delegateAddress, amountBonded] = delegator;
      assert.equal(0, delegateAddress);
      assert.equal(0, amountBonded);
      assert.equal(DELEGATOR_UNBONDED, await tdpos.delegatorStatus(accounts[3]));
    });

    it('should return Bonded if Delegator has called bond()', async () => {
      assert.equal(DELEGATOR_UNBONDED, await tdpos.delegatorStatus(accounts[4]));
      await tdpos.approve(contractAddress, 300, {from: accounts[4]});
      await tdpos.bond(accounts[0], 300, {from: accounts[4]});
      assert.equal(DELEGATOR_BONDED, await tdpos.delegatorStatus(accounts[4]));
    });

    it('should return Unbonding if Delegator has called unbond()', async () => {
      assert.equal(DELEGATOR_BONDED, await tdpos.delegatorStatus(accounts[4]));
      await tdpos.unbond({from: accounts[4]});
      assert.equal(DELEGATOR_UNBONDING, await tdpos.delegatorStatus(accounts[4]));
    });

    it('should return Unbonded if Delegator has called unbond() and withdraw()', async () => {
      assert.equal(DELEGATOR_UNBONDING, await tdpos.delegatorStatus(accounts[4]));
      const unbondingInformation = await tdpos.unbondingInformations(accounts[4]);
      const withdrawBlock = unbondingInformation[0];
      await blockMiner.mineUntilBlock(withdrawBlock - 1);
      await tdpos.withdraw({from: accounts[4]});
      assert.equal(DELEGATOR_UNBONDED, await tdpos.delegatorStatus(accounts[4]));
    });
  });

  describe('providerStatus', () => {
    before(async () => {
      await initNew();
      await approveBondProvider(...STANDARD_PROVIDER_PARAMETERS, 1, accounts[0]);
    });

    it('should return Unregistered if address is not a Provider', async () => {
      assert.equal(PROVIDER_UNREGISTERED, await tdpos.providerStatus.call(accounts[1]));
    });

    it('should return Registered if address has called provider()', async () => {
      assert.equal(PROVIDER_REGISTERED, await tdpos.providerStatus.call(accounts[0]));
    });

    it('should return Unregistered if Provider has resigned', async () => {
      await tdpos.unbond({from: accounts[0]});
      assert.equal(PROVIDER_UNREGISTERED, await tdpos.providerStatus.call(accounts[0]));
    });
  });

  describe('withdraw', () => {
    before(async () => {
      await initNew();
      await approveBondProvider(...STANDARD_PROVIDER_PARAMETERS, 1, accounts[0]);
      await approveBondProvider(...STANDARD_PROVIDER_PARAMETERS, 1, accounts[1]);
      await tdpos.approve(contractAddress, 300, {from: accounts[2]});
      await tdpos.bond(accounts[0], 300, {from: accounts[2]});
      await tdpos.approve(contractAddress, 300, {from: accounts[3]});
      await tdpos.bond(accounts[0], 300, {from: accounts[3]});
    });

    it('should fail if withdrawBlock has not been reached', async () => {
      await tdpos.unbond({from: accounts[2]});
      assert.equal(DELEGATOR_UNBONDING, await tdpos.delegatorStatus(accounts[2]));
      const unbondingInformation = await tdpos.unbondingInformations(accounts[2]);
      const withdrawBlock = unbondingInformation[0];
      await blockMiner.mineUntilBlock(withdrawBlock - 2);
      // At this point we are 1 block away from withdrawBlock
      await assertFail( tdpos.withdraw({from: accounts[2]}) );
      // At this point we reached withdrawBlock so it should work
      await tdpos.withdraw({from: accounts[2]});
      assert.equal(DELEGATOR_UNBONDED, await tdpos.delegatorStatus(accounts[2]));
    });

    it('should fail if Delegator is in Bonded state', async () => {
      assert.equal(DELEGATOR_BONDED, await tdpos.delegatorStatus(accounts[3]));
      await assertFail( tdpos.withdraw({from: accounts[3]}) );
    });

    it('should fail if Delegator is in Unbonded state', async () => {
      assert.equal(DELEGATOR_UNBONDED, await tdpos.delegatorStatus(accounts[5]));
      await assertFail( tdpos.withdraw({from: accounts[5]}) );
    });

    it('should transfer the right amount of tokens back to the Delegator', async () => {
      const previousBalance = await tdpos.balanceOf(accounts[3]);
      await tdpos.unbond({from: accounts[3]});
      const unbondingInformation = await tdpos.unbondingInformations(accounts[3]);
      const withdrawBlock = unbondingInformation[0];
      await blockMiner.mineUntilBlock(withdrawBlock - 1);
      await tdpos.withdraw({from: accounts[3]});
      const newBalance = await tdpos.balanceOf(accounts[3]);
      assert.equal(previousBalance.plus(300).toNumber(), newBalance);
    });

    it('should switch Delegator status to Unbonded', async () => {
      assert.equal(DELEGATOR_UNBONDED, await tdpos.delegatorStatus(accounts[3]));
    });

    it('should delete unbondingInformation', async () => {
      await tdpos.approve(contractAddress, 400, {from: accounts[4]});
      await tdpos.bond(accounts[0], 400, {from: accounts[4]});
      await tdpos.unbond({from: accounts[4]});
      let unbondingInformation = await tdpos.unbondingInformations.call(accounts[4]);
      let [withdrawBlock, amount] = unbondingInformation;
      assert(0 < withdrawBlock);
      assert(0 < amount);
      await blockMiner.mineUntilBlock(withdrawBlock - 1);
      await tdpos.withdraw({from: accounts[4]});
      unbondingInformation = await tdpos.unbondingInformations.call(accounts[4]);
      [withdrawBlock, amount] = unbondingInformation;
      assert.equal(0, withdrawBlock);
      assert.equal(0, amount);
    });
  });

  describe('rebond', () => {
    let provider1;
    let provider2;
    let delegator1;
    let delegator2;
    let notRegistered;

    before(async () => {
      provider1 = accounts[0];
      provider2 = accounts[1];
      delegator1 = accounts[2];
      delegator2 = accounts[3];
      notRegistered = accounts[4];
      await initNew();
      await approveBondProvider(...STANDARD_PROVIDER_PARAMETERS, 1, provider1);
      await approveBondProvider(...STANDARD_PROVIDER_PARAMETERS, 1, provider2);
      await tdpos.approve(contractAddress, 200, {from: delegator1});
      await tdpos.bond(provider1, 200, {from: delegator1});
      await tdpos.approve(contractAddress, 300, {from: delegator2});
      await tdpos.bond(provider1, 300, {from: delegator2});
      await tdpos.unbond({from: delegator2});
    });

    it('should fail if Delegator is in Bonded state', async () => {
      assert.equal(DELEGATOR_BONDED, await tdpos.delegatorStatus(delegator1));
      await assertFail( tdpos.rebond(provider1, {from: delegator1}) );
    });

    it('should fail if Delegator is in Unbonded state', async () => {
      assert.equal(DELEGATOR_UNBONDED, await tdpos.delegatorStatus(notRegistered));
      await assertFail( tdpos.rebond(provider1, {from: notRegistered}) );
    });

    it('should set the amountBonded for the same amount that was bonded before', async () => {
      assert.equal(DELEGATOR_UNBONDING, await tdpos.delegatorStatus(delegator2));
      const unbondingInformation = await tdpos.unbondingInformations.call(delegator2);
      const previousAmountBonded = unbondingInformation[1];
      await tdpos.rebond(provider2, {from: delegator2});
      const delegator = await tdpos.delegators.call(delegator2);
      const amountBonded = delegator[1];
      assert.deepEqual(previousAmountBonded, amountBonded);
    });

    it('should fail if target is not a Registered Provider or the Delegator himself', async () => {
      // target is a Registered Provider
      await tdpos.unbond({from: delegator2});
      await tdpos.rebond(provider2, {from: delegator2});
      // target is a Delegator himself
      await tdpos.unbond({from: delegator2});
      await tdpos.rebond(delegator2, {from: delegator2});
      // target is neither
      await tdpos.unbond({from: delegator2});
      await assertFail( tdpos.rebond(notRegistered, {from: delegator2}) );
    });

    it('should create an entry in the delegators mapping', async () => {
      let delegator = await tdpos.delegators.call(delegator2);
      let [delegateAddress, amountBonded] = delegator;
      assert.equal(0, delegateAddress);
      assert.equal(0, amountBonded);
      await tdpos.rebond(provider2, {from: delegator2});
      delegator = await tdpos.delegators.call(delegator2);
      [delegateAddress, amountBonded] = delegator;
      assert.equal(provider2, delegateAddress);
      assert.equal(300, amountBonded);
    });

    it('should update the stake of the target Provider', async () => {
      await tdpos.unbond({from: delegator2});
      const previousStake = await tdpos.getProviderStake.call(provider1);
      await tdpos.rebond(provider1, {from: delegator2});
      const delegator = await tdpos.delegators.call(delegator2);
      const amountBonded = delegator[1];
      const currentStake = await tdpos.getProviderStake.call(provider1);
      assert.deepEqual(previousStake.add(amountBonded), currentStake);
    });

    it('should emit an DelegatorBonded event', async () => {
      const delegator = await tdpos.delegators.call(delegator2);
      const amountBonded = delegator[1].toNumber();
      await tdpos.unbond({from: delegator2});
      const result = await tdpos.rebond(provider1, {from: delegator2});
      assert.web3Event(result, {
        event: 'DelegatorBonded',
        args: {
          delegator: delegator2,
          provider: provider1,
          amount: amountBonded,
        },
      });
    });

    it('should switch Delegator status to Bonded', async () => {
      await tdpos.unbond({from: delegator2});
      assert.equal(DELEGATOR_UNBONDING, await tdpos.delegatorStatus(delegator2));
      await tdpos.rebond(provider2, {from: delegator2});
      assert.equal(DELEGATOR_BONDED, await tdpos.delegatorStatus(delegator2));
    });

    it('should delete unbondingInformation', async () => {
      await tdpos.unbond({from: delegator2});
      let unbondingInformation = await tdpos.unbondingInformations.call(delegator2);
      let [withdrawBlock, amount] = unbondingInformation;
      assert(0 < withdrawBlock);
      assert(0 < amount);
      await tdpos.rebond(provider2, {from: delegator2});
      unbondingInformation = await tdpos.unbondingInformations.call(delegator2);
      [withdrawBlock, amount] = unbondingInformation;
      assert.equal(0, withdrawBlock);
      assert.equal(0, amount);
    });
  });
});

