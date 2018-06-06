const TST = artifacts.require('./TransmuteToken.sol');

contract('TST', accounts => {
  let owner, tst;

  it('can mint new tokens', async () => {
    owner = accounts[0];
    tst = await TST.deployed({from: owner});
    console.log(tst);
  });
});
