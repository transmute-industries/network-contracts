const Warden = artifacts.require('./Warden.sol');

contract('Warden', accounts => {
  it('constructor works', async () => {
    const warden = await Warden.deployed();
    assert(accounts[0] === (await warden.owner()));
  });

  it('owner can write and read', async () => {
    const warden = await Warden.deployed();

    const rec = await warden.write('key', 'value');

    assert(rec.tx);
    assert(rec.receipt);
    assert(rec.logs[0].event === 'TransmuteEvent');
    assert(rec.logs[0].args.index);
    assert(rec.logs[0].args.sender === (await warden.owner()));
    assert(rec.logs[0].args.key);
    assert(rec.logs[0].args.value);

    const eventValues = await warden.read(0);

    assert(rec.logs[0].args.index.toNumber() === eventValues[0].toNumber());
    assert(rec.logs[0].args.sender === eventValues[1]);
    assert(rec.logs[0].args.key === eventValues[2]);
    assert(rec.logs[0].args.value === eventValues[3]);
  });

});
