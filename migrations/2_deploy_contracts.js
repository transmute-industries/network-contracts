const EventStoreLib = artifacts.require(
  'transmute-framework/contracts/EventStoreLib.sol'
);
const EventStore = artifacts.require(
  'transmute-framework/contracts/EventStore.sol'
);

const Warden = artifacts.require('./Warden.sol');

module.exports = deployer => {
  deployer.deploy(EventStoreLib);
  deployer.link(EventStoreLib, EventStore);
  deployer.deploy(EventStore);

  deployer.link(EventStoreLib, Warden);
  deployer.link(EventStore, Warden);
  deployer.deploy(Warden);
};
