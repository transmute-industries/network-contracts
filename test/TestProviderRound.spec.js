const ProviderRound = artifacts.require('./ProviderRound.sol');

contract('ProviderRound', accounts => {

  let providerRound;

  it('providers can register their parameters', async () => {
    providerRound = await ProviderRound.deployed();
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
});

