pragma solidity ^0.4.24;

contract ProviderManager {
  //TODO: remove _
  event ProviderAdded (
    address indexed _provider,
    uint _pricePerStorageMineral,
    uint _pricePerComputeMineral,
    uint _blockRewardCut,
    uint _feeShare
  );

  event ProviderUpdated (
    address indexed _provider,
    uint _pricePerStorageMineral,
    uint _pricePerComputeMineral,
    uint _blockRewardCut,
    uint _feeShare
  );

  event ProviderResigned (
    address indexed _provider
  );

  enum ProviderStatus { Unregistered, Registered }

  struct Provider {
    uint pricePerStorageMineral;
    uint pricePerComputeMineral;
    uint blockRewardCut;
    uint feeShare;
  }

  uint public numberOfProviders;
  // TODO: rename to registeredProviders
  mapping(address => Provider) public providers;

  // Saves the parameters of active providers for that round.
  // Any updates via provider() will save the parameters in providers mapping
  // and will be copied to this mapping at the next call of initializeRound()
  mapping(address => Provider) public activeProviders;
}
