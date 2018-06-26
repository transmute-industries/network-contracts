const ProviderRound = artifacts.require('./ProviderRound.sol');
const { blockMiner, assertFail } = require('./utils.js');

contract('ProviderRound', accounts => {

  let providerRound;

  describe('provider', () => {

    before(async () => {
      providerRound = await ProviderRound.deployed();
    });

    beforeEach(async () => {
      await blockMiner.mineUntilBeginningOfNextRound(providerRound);
      await providerRound.initializeRound();
    });

    it("should register a provider's parameters", async () => {
      await providerRound.provider(22, 10, 1, 25, {from: accounts[0]});
      await providerRound.provider(10, 20, 2, 35, {from: accounts[1]});
      let firstProvider = await providerRound.providerCandidates.call(0);
      let secondProvider = await providerRound.providerCandidates.call(1);
      assert(firstProvider[0] == accounts[0]
        && firstProvider[1].toNumber() == 22
        && firstProvider[2].toNumber() == 10
        && firstProvider[3].toNumber() == 1
        && firstProvider[4].toNumber() == 25
      );
      assert(secondProvider[0] == accounts[1]
        && secondProvider[1].toNumber() == 10
        && secondProvider[2].toNumber() == 20
        && secondProvider[3].toNumber() == 2
        && secondProvider[4].toNumber() == 35
      );
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
      const firstProvider = await providerRound.providerCandidates.call(0);
      assert.equal(accounts[0], firstProvider[0]);
      assert.equal(0, firstProvider[5]);
    });

    it('should fail if not called during an active round', async () => {
      // Mine until round is no longer active
      const roundLength = await providerRound.roundLength.call();
      await blockMiner.mineUntilBeginningOfNextRound(providerRound);
      await assertFail( providerRound.provider(22, 10, 1, 25) );
    });

    it('should register parameters before the lock period of an active round', async () => {
      const roundLength = await providerRound.roundLength.call();
      await blockMiner.mineUntilLastBlockBeforeLockPeriod(providerRound);
      await providerRound.provider(22, 10, 1, 25);
    });

    it('should fail during the lock period of an active round', async () => {
      const roundLength = await providerRound.roundLength.call();
      await blockMiner.mineUntilLastBlockBeforeLockPeriod(providerRound);
      // Enter lock period
      await blockMiner.mine(1);
      await assertFail( providerRound.provider(22, 10, 1, 25) );
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
      await blockMiner.mineUntilBeginningOfNextRound(providerRound);
      await providerRound.initializeRound();
      await providerRound.provider(22, 10, 1, 25, {from: accounts[0]});
      await providerRound.provider(10, 20, 2, 35, {from: accounts[1]});
    });

    it('should fail if the delegator does not approve to transfer at least the bonded amount', async () => {
      await assertFail( providerRound.bond(0, 10, {from: accounts[5]}) );
      await providerRound.approve(contractAddress, 9, {from: accounts[5]});
      await assertFail( providerRound.bond(0, 10, {from: accounts[5]}) );
    });

    it('should add a delegator to the delegators list', async () => {
      await providerRound.approve(contractAddress, 10, {from: accounts[5]});
      await providerRound.bond(0, 10, {from: accounts[5]});
      const firstDelegator = await providerRound.delegators.call(accounts[5]);
      assert.equal(accounts[0], firstDelegator[0]);
      assert.equal(10, firstDelegator[1]);
    });

    it('should increase the totalAmountBonded of the provider', async () => {
      let firstProvider = await providerRound.providerCandidates.call(0);
      assert.equal(10, firstProvider[5]);

      await providerRound.approve(contractAddress, 20, {from: accounts[6]});
      await providerRound.bond(1, 20, {from: accounts[6]});
      await providerRound.approve(contractAddress, 50, {from: accounts[7]});
      await providerRound.bond(1, 50, {from: accounts[7]});
      firstProvider = await providerRound.providerCandidates.call(0);
      const secondProvider = await providerRound.providerCandidates.call(1);
      assert.equal(10, firstProvider[5]);
      assert.equal(70, secondProvider[5]);
    });

    it('should fail if no providerCandidate is associated with the given providerCandidateId', async () => {
      await assertFail( providerRound.bond(2, 15, {from: accounts[5]}) );
    });

    it('should fail if called twice by the same delegator', async () => {
      await providerRound.approve(contractAddress, 40, {from: accounts[8]});
      await providerRound.bond(1, 40, {from: accounts[8]});
      await assertFail( providerRound.bond(1, 40, {from: accounts[8]}) );
    });

    it('should fail if TST balance is less than bonded amount', async () => {
      await providerRound.approve(contractAddress, 1001, {from: accounts[9]});
      await assertFail( providerRound.bond(1, 1001, {from: accounts[9]}) )
      assert.equal(110, (await providerRound.providerCandidates(1))[5]);
    });

    it("should transfer amount from the delegator's balance to the contract's balance", async () => {
      const contractBalance = (await providerRound.balanceOf(providerRound.address)).toNumber();
      assert.equal(1000, await providerRound.balanceOf(accounts[9]));
      await providerRound.approve(contractAddress, 300, {from: accounts[9]});
      await providerRound.bond(1, 300, {from: accounts[9]});
      assert.equal(700, await providerRound.balanceOf(accounts[9]));
      assert.equal(contractBalance + 300, await providerRound.balanceOf(providerRound.address));
    });
  });
});

