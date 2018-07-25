const TransmuteDPOS = artifacts.require('./TestTransmuteDPOS.sol');
const { blockMiner, assertFail } = require('../utils.js');
require('truffle-test-utils').init();

contract('TransmuteDPOS', accounts => {

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
    for(let i = 0; i < 10; i++) {
      await tdpos.mint(accounts[i], 1000, {from: accounts[0]});
    }
    await tdpos.setMaxNumberOfProviders(PROVIDER_POOL_SIZE);
    await blockMiner.mineUntilEndOfElectionPeriod(tdpos);
    await tdpos.initializeRound();
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

    it('should fail if the Provider does not bond some tokens on himself first', async () => {
      await assertFail( tdpos.provider(22, 10, 1, 25, {from: accounts[0]}) );
    });

    it('should initially set totalBondedAmount to the amount the Provider bonded to himself', async () => {
      await approveBondProvider(22, 10, 1, 25, 42, accounts[0]);
      const provider = await tdpos.providers.call(accounts[0]);
      const totalBondedAmount = provider[4];
      assert.equal(42, totalBondedAmount);
    });

    it("should register a Provider's parameters", async () => {
      assert.equal(PROVIDER_UNREGISTERED, await tdpos.providerStatus.call(accounts[1]));
      await approveBondProvider(10, 20, 2, 35, 1, accounts[1]);
      const provider = await tdpos.providers.call(accounts[1]);
      let [pricePerStorageMineral, pricePerComputeMineral,
        blockRewardCut, feeShare] = provider;
      assert.equal(PROVIDER_REGISTERED, await tdpos.providerStatus.call(accounts[1]));
      assert.equal(10, pricePerStorageMineral);
      assert.equal(20, pricePerComputeMineral);
      assert.equal(2, blockRewardCut);
      assert.equal(35, feeShare);
    });

    it('should fail with invalid parameters', async () => {
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
      const pricePerStorageMineral = provider[0];
      assert.equal(23, pricePerStorageMineral);
    });

    it('should fail during the lock period of an active round', async () => {
      await blockMiner.mineUntilLastBlockBeforeLockPeriod(tdpos);
      // Enter lock period
      await blockMiner.mine(1);
      await assertFail( tdpos.provider(22, 10, 1, 25, {from: accounts[0]}) );
    });

    it('should send a ProviderAdded event for a new Provider', async () => {
      const result = await tdpos.provider(22, 10, 1, 25, {from: accounts[2]});
      assert.web3Event(result, {
        event: 'ProviderAdded',
        args: {
          _provider: accounts[2],
          _pricePerStorageMineral: 22,
          _pricePerComputeMineral: 10,
          _blockRewardCut: 1,
          _feeShare: 25,
        }
      });
    });

    it('should send a ProviderUpdated event for an existing Provider', async () => {
      const result = await tdpos.provider(21, 11, 2, 24, {from: accounts[2]});
      assert.web3Event(result, {
        event: 'ProviderUpdated',
        args: {
          _provider: accounts[2],
          _pricePerStorageMineral: 21,
          _pricePerComputeMineral: 11,
          _blockRewardCut: 2,
          _feeShare: 24,
        }
      });
    });

    it('should add the Provider to the pool if he is Unregistered and size < maxSize', async () => {
      // Check that provider isn't registered yet
      assert.equal(PROVIDER_UNREGISTERED, await tdpos.providerStatus.call(accounts[3]));
      // Check the size of the pool increases by 1
      let providerPool = await tdpos.providerPool.call();
      const previousSize = providerPool[3].toNumber();
      await approveBondProvider(21, 13, 3, 26, 1, accounts[3]);
      providerPool = await tdpos.providerPool.call();
      assert.equal(previousSize + 1, providerPool[3]);
      // Check that the provider is registered in the pool now
      assert.equal(true, await tdpos.containsProvider(accounts[3]));
    });

    it('should fail if Provider is Unregistered and size == maxSize', async () => {
      let providerPool = await tdpos.providerPool.call();
      const maxSize = providerPool[2].toNumber();
      let currentSize = providerPool[3];
      assert.isAbove(maxSize, currentSize.toNumber());
      await approveBondProvider(20 ,10, 2, 25, 1, accounts[4]);
      providerPool = await tdpos.providerPool.call();
      currentSize = providerPool[3];
      assert.equal(maxSize, currentSize);
      await assertFail( approveBondProvider(20 ,10, 2, 25, 1, accounts[5]) );
    });

    it('should work if Provider is Registered and size == maxSize', async () => {
      let provider = await tdpos.providers.call(accounts[4]);
      pricePerStorageMineral = provider[0];
      assert.equal(20, pricePerStorageMineral);
      await tdpos.provider(21 ,10, 2, 25, {from: accounts[4]});
      provider = await tdpos.providers.call(accounts[4]);
      pricePerStorageMineral = provider[0];
      assert.equal(21, pricePerStorageMineral);
    });
  });

  describe('resignAsProvider', () => {

    before(async () => {
      await initNew();
      await approveBondProvider(22, 10, 1, 25, 1, accounts[0]);
      await approveBondProvider(22, 10, 1, 25, 1, accounts[1]);
      await approveBondProvider(22, 10, 1, 25, 1, accounts[2]);
    });

    it('should remove the Provider from the provider mapping', async () => {
      const registeredProvider = await tdpos.providers.call(accounts[0]);
      let providerStatus = await tdpos.providerStatus.call(accounts[0]);
      assert.equal(PROVIDER_REGISTERED, providerStatus);
      await tdpos.publicResignAsProvider(accounts[0]);
      const resignedProvider = await tdpos.providers.call(accounts[0]);
      let [pricePerStorageMineral, pricePerComputeMineral,
        blockRewardCut, feeShare, totalAmountBonded] = resignedProvider;
      providerStatus = await tdpos.providerStatus.call(accounts[0]);
      assert.equal(PROVIDER_UNREGISTERED, providerStatus);
      assert.equal(0, pricePerStorageMineral);
      assert.equal(0, pricePerComputeMineral);
      assert.equal(0, blockRewardCut);
      assert.equal(0, feeShare);
      assert.equal(0, totalAmountBonded);
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
          _provider: accounts[2],
        }
      });
    });

    it("should fail if the transaction's sender is not a Provider", async () => {
      await assertFail( tdpos.publicResignAsProvider(accounts[3]) );
    });
  });

  describe('bond', () => {

    before(async () => {
      await initNew();
      await approveBondProvider(22, 10, 1, 25, 1, accounts[0]);
      await approveBondProvider(10, 20, 2, 35, 1, accounts[1]);
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

    it('should increase the totalAmountBonded of the Provider', async () => {
      await tdpos.bond(accounts[0], 20, {from: accounts[6]});
      const provider = await tdpos.providers.call(accounts[0]);
      const totalAmountBonded = provider[4];
      assert.equal(31, totalAmountBonded);
    });

    it('should fail if the address is not a registered Provider address', async () => {
      await tdpos.approve(contractAddress, 15, {from: accounts[7]})
      await assertFail( tdpos.bond(accounts[2], 15, {from: accounts[7]}) );
    });

    it('should work if the address is not a registered Provider address but the address is the sender address', async () => {
      await tdpos.approve(contractAddress, 15, {from: accounts[3]})
      await tdpos.bond(accounts[3], 15, {from: accounts[3]});
    });

    it('should fail if called twice by the same Delegator', async () => {
      await tdpos.approve(contractAddress, 40, {from: accounts[8]});
      await tdpos.bond(accounts[1], 20, {from: accounts[8]});
      await assertFail( tdpos.bond(accounts[1], 20, {from: accounts[8]}) );
    });

    it('should fail if TST balance is less than bonded amount', async () => {
      await tdpos.approve(contractAddress, 1001, {from: accounts[9]});
      await assertFail( tdpos.bond(accounts[1], 1001, {from: accounts[9]}) )
      const provider = await tdpos.providers.call(accounts[1]);
      const totalAmountBonded = provider[4];
      assert(1001 >= totalAmountBonded);
    });

    it("should transfer amount from the Delegator's balance to the contract's balance", async () => {
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

    it('should update the totalBondedAmount of the Provider in the providerPool if he is already registered', async () => {
      let provider = await tdpos.getProvider.call(accounts[0]);
      const previousBondedAmount = provider[0].toNumber();
      await tdpos.approve(contractAddress, 300, {from: accounts[7]});
      await tdpos.bond(accounts[0], 300, {from: accounts[7]});
      provider = await tdpos.getProvider.call(accounts[0]);
      assert.equal(300 + previousBondedAmount, provider[0]);
    });

    it('should emit the DelegateBonded event', async () => {
      await tdpos.approve(contractAddress, 300, {from: accounts[4]});
      const result = await tdpos.bond(accounts[0], 300, {from: accounts[4]});
      assert.web3Event(result, {
        event: 'DelegatorBonded',
        args: {
          _delegator: accounts[4],
          _provider: accounts[0],
          _amount: 300
        }
      });
    });
  });

  describe('unbond', () => {

    before(async () => {
      await initNew();
      await approveBondProvider(22, 10, 1, 25, 1, accounts[0]);
      await approveBondProvider(22, 10, 1, 25, 1, accounts[1]);
      await tdpos.approve(contractAddress, 300, {from: accounts[2]});
      await tdpos.bond(accounts[0], 300, {from: accounts[2]});
      await tdpos.approve(contractAddress, 300, {from: accounts[3]});
      await tdpos.bond(accounts[0], 300, {from: accounts[3]});
      await tdpos.approve(contractAddress, 300, {from: accounts[4]});
      await tdpos.bond(accounts[0], 300, {from: accounts[4]});
      await tdpos.approve(contractAddress, 300, {from: accounts[5]});
      await tdpos.bond(accounts[0], 300, {from: accounts[5]});
    });

    it('should fail if called by an address that is not a Delegator (no bonded amount)', async () => {
      assert.equal(DELEGATOR_UNBONDED, await tdpos.delegatorStatus(accounts[9]));
      await assertFail( tdpos.unbond({from: accounts[9]}) );
    });

    it("should set withdrawInformation for the Delegator's address", async () => {
      let withdrawInformation = await tdpos.withdrawInformations.call(accounts[2]);
      let withdrawBlock = withdrawInformation[0];
      assert.equal(0, withdrawBlock);
      await tdpos.unbond({from: accounts[2]});
      const currentBlockNumber = web3.eth.blockNumber;
      const unbondingPeriod = (await tdpos.unbondingPeriod.call()).toNumber();
      withdrawInformation = await tdpos.withdrawInformations.call(accounts[2]);
      withdrawBlock = withdrawInformation[0];
      assert.equal(currentBlockNumber + unbondingPeriod, withdrawBlock);
    });

    it('should decrease the totalBondedAmount of the Provider by the unbonded amount', async () => {
      const totalBondedAmount = (await tdpos.providers(accounts[0]))[4];
      const bondedAmount = (await tdpos.delegators(accounts[3]))[1];
      const newAmount = totalBondedAmount - bondedAmount;
      await tdpos.unbond({from: accounts[3]});
      assert.equal(newAmount, (await tdpos.providers([accounts[0]]))[4]);
      assert.equal(newAmount, (await tdpos.getProvider(accounts[0]))[0]);
    });

    it('should resign the Provider if a Provider calls the function', async () => {
      assert.equal(PROVIDER_REGISTERED, await tdpos.providerStatus.call(accounts[1]));
      await tdpos.unbond({from: accounts[1]});
      assert.equal(PROVIDER_UNREGISTERED, await tdpos.providerStatus.call(accounts[1]));
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
          _delegator: accounts[5],
          _provider: accounts[0],
          _amount: 300
        }
      });
    });
  });

  describe('delegatorStatus', () => {

    before(async () => {
      await initNew();
      await approveBondProvider(22, 10, 1, 25, 1, accounts[0]);
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

    it('should return UnbondedWithTokensToWithdraw if Delegator has called unbond()', async () => {
      assert.equal(DELEGATOR_BONDED, await tdpos.delegatorStatus(accounts[4]));
      await tdpos.unbond({from: accounts[4]});
      assert.equal(DELEGATOR_UNBONDED_WITH_TOKENS_TO_WITHDRAW, await tdpos.delegatorStatus(accounts[4]));
    });

    it('should return Unbonded if Delegator has called unbond() and withdraw()', async () => {
      assert.equal(DELEGATOR_UNBONDED_WITH_TOKENS_TO_WITHDRAW, await tdpos.delegatorStatus(accounts[4]));
      const withdrawInformation = await tdpos.withdrawInformations(accounts[4]);
      const withdrawBlock = withdrawInformation[0];
      await blockMiner.mineUntilBlock(withdrawBlock - 1);
      await tdpos.withdraw({from: accounts[4]});
      assert.equal(DELEGATOR_UNBONDED, await tdpos.delegatorStatus(accounts[4]));
    });
  });

  describe('providerStatus', () => {

    before(async () => {
      await initNew();
      await approveBondProvider(22, 10, 1, 25, 1, accounts[0]);
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
      await approveBondProvider(22, 10, 1, 25, 1, accounts[0]);
      await approveBondProvider(22, 10, 1, 25, 1, accounts[1]);
      await tdpos.approve(contractAddress, 300, {from: accounts[2]});
      await tdpos.bond(accounts[0], 300, {from: accounts[2]});
      await tdpos.approve(contractAddress, 300, {from: accounts[3]});
      await tdpos.bond(accounts[0], 300, {from: accounts[3]});
    });

    it('should fail if withdrawBlock has not been reached', async () => {
      await tdpos.unbond({from: accounts[2]});
      assert.equal(DELEGATOR_UNBONDED_WITH_TOKENS_TO_WITHDRAW, await tdpos.delegatorStatus(accounts[2]));
      const withdrawInformation = await tdpos.withdrawInformations(accounts[2]);
      const withdrawBlock = withdrawInformation[0];
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
      assert.equal(DELEGATOR_UNBONDED, await tdpos.delegatorStatus(accounts[4]));
      await assertFail( tdpos.withdraw({from: accounts[4]}) );
    });

    it('should transfer the right amount of tokens back to the Delegator', async () => {
      const previousBalance = await tdpos.balanceOf(accounts[3]);
      await tdpos.unbond({from: accounts[3]});
      const withdrawInformation = await tdpos.withdrawInformations(accounts[3]);
      const withdrawBlock = withdrawInformation[0];
      await blockMiner.mineUntilBlock(withdrawBlock - 1);
      await tdpos.withdraw({from: accounts[3]});
      const newBalance = await tdpos.balanceOf(accounts[3]);
      assert.equal(previousBalance.plus(300).toNumber(), await tdpos.balanceOf(accounts[3]));
    });

    it('should switch Delegator status to Unbonded', async () => {
      assert.equal(DELEGATOR_UNBONDED, await tdpos.delegatorStatus(accounts[3]));
    });
  });
});

