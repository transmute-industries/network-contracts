const TST = artifacts.require('./TransmuteToken.sol');
const utils = require('../utils.js');
const assertFail = utils.assertFail;

contract('TST', (accounts) => {
  let owner; let tst;
  const tokenAmount = 1000;

  it('should have the correct owner', async () => {
    owner = accounts[0];
    tst = await TST.deployed();
    assert(owner == await tst.owner.call());
  });

  it('should allow owner to mint new tokens', async () => {
    assert(0 === (await tst.balanceOf.call(owner)).toNumber());
    await tst.mint(owner, tokenAmount, {from: owner});
    assert(tokenAmount === (await tst.balanceOf.call(owner)).toNumber());

    await tst.mint(accounts[1], tokenAmount, {from: owner});
    assert(tokenAmount === (await tst.balanceOf.call(accounts[1])).toNumber());
  });

  it('should fail if anyone else than owner wants to mint new tokens', async () => {
    await assertFail(
      tst.mint(owner, tokenAmount, {from: accounts[1]}),
      'this account should not be able to mint tokens'
    );
  });

  it('should fail to mint new tokens after finishMinting is called', async () => {
    await tst.finishMinting({from: owner});
    await assertFail(
      tst.mint(owner, tokenAmount, {from: owner}),
      'owner should not be able to mint token after finishMinting is called'
    );
  });

  it('should transfer tokens with approval', async () => {
    let approvedAmount = tokenAmount / 10;
    assert(approvedAmount <= (await tst.balanceOf(accounts[1])).toNumber());
    await tst.approve(accounts[3], approvedAmount, {from: accounts[1]});
    await tst.transferFrom(accounts[1], accounts[2], approvedAmount, {from: accounts[3]});
    assert(approvedAmount === (await tst.balanceOf(accounts[2])).toNumber());
    assert(tokenAmount - approvedAmount === (await tst.balanceOf(accounts[1])).toNumber());
  });

  it('should fail to transfer tokens without approval', async () => {
    await assertFail(
      tst.transferFrom(owner, accounts[2], tokenAmount / 10, {from: owner}),
      'should not be able to transfer tokens without approval'
    );
  });

  it('should fail to transfer more tokens than approved', async () => {
    let approvedAmount = tokenAmount / 20;
    assert(approvedAmount <= (await tst.balanceOf(accounts[2])).toNumber());
    await tst.approve(accounts[4], approvedAmount, {from: accounts[2]});
    await assertFail(
      tst.transferFrom(accounts[2], accounts[3], approvedAmount + 1, {from: accounts[4]}),
      'should not be able to transfer more tokens than what was approved'
    );
  });
});
