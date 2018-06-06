const TST = artifacts.require('./TransmuteToken.sol');

contract('TST', accounts => {
  let owner, tst;
  const tokenAmount = 1000;

  it('has the correct owner', async () => {
    owner = accounts[0];
    tst = await TST.deployed();
    assert(owner == await tst.owner.call());
  });

  it('owner can mint new tokens', async () => {
    assert(0 === (await tst.balanceOf.call(owner)).toNumber());
    await tst.mint(owner, tokenAmount, {from: owner});
    assert(tokenAmount === (await tst.balanceOf.call(owner)).toNumber());

    await tst.mint(accounts[1], tokenAmount, {from: owner});
    assert(tokenAmount === (await tst.balanceOf.call(accounts[1])).toNumber());
  });

  it('only owner can mint new tokens', async() => {
    try {
      await tst.mint(owner, tokenAmount, {from: accounts[1]});
      assert(false);
    } catch(e) {
      if (e.name == 'AssertionError') {
        assert(false, 'this account should not be able to mint tokens');
      }
    }
  });

  it('can transfer tokens with approval', async () => {
    let approvedAmount = tokenAmount / 10;
    assert(approvedAmount <= (await tst.balanceOf(accounts[1])).toNumber());
    await tst.approve(accounts[3], approvedAmount, {from: accounts[1]});
    await tst.transferFrom(accounts[1], accounts[2], approvedAmount, {from: accounts[3]});
    assert(approvedAmount === (await tst.balanceOf(accounts[2])).toNumber());
    assert(tokenAmount - approvedAmount === (await tst.balanceOf(accounts[1])).toNumber());
  });

  it('cannot transfer tokens without approval', async () => {
    try {
      await tst.transferFrom(owner, accounts[2], tokenAmount / 10, {from: owner});
      assert(false);
    } catch(e) {
      if (e.name == 'AssertionError') {
        assert(false, 'should not be able to transfer tokens without approval');
      }
    }
  });

  it('cannot transfer more tokens than approved', async () => {
    let approvedAmount = tokenAmount / 20;
    assert(approvedAmount <= (await tst.balanceOf(accounts[2])).toNumber());
    await tst.approve(accounts[4], approvedAmount, {from: accounts[2]});
    try {
      await tst.transferFrom(accounts[2], accounts[3], approvedAmount + 1 , {from: accounts[4]});
      console.log('coucou');
      assert(false);
    } catch(e) {
      if (e.name == 'AssertionError') {
        assert(false, 'should not be able to transfer more tokens than what was approved');
      }
    }
  });

  it('owner cannot mint new token after finishMinting is called', async() => {
    await tst.finishMinting({from: owner});
    try {
      await tst.mint(owner, tokenAmount, {from: owner});
      assert(false);
    } catch(e) {
      if (e.name == 'AssertionError') {
        assert(false, 'owner should not be able to mint token after finishMinting is called');
      }
    }
  });
});
