pragma solidity ^0.4.24;

contract ProviderManager {
  event ProviderAdded (
    address indexed provider,
    uint pricePerStorageMineral,
    uint pricePerComputeMineral,
    uint blockRewardCut,
    uint feeShare,
    uint amount
  );

  event ProviderUpdated (
    address indexed provider,
    uint pricePerStorageMineral,
    uint pricePerComputeMineral,
    uint blockRewardCut,
    uint feeShare,
    uint amount
  );

  event ProviderResigned (
    address indexed provider
  );

  enum ProviderStatus {
    Unregistered,
    Registered,
    RegisteredAndActive,
    RegisteredAndActiveAndUnavailable
  }

  struct Provider {
    uint pricePerStorageMineral;
    uint pricePerComputeMineral;
    uint blockRewardCut;
    uint feeShare;
  }

  uint public numberOfProviders;
  mapping(address => Provider) public registeredProviders;

  // Saves the parameters of active providers for that round.
  // Any updates via provider() will save the parameters in registeredProviders mapping
  // and will be copied to this mapping at the next call of initializeRound()
  mapping(address => Provider) public activeProviders;
}
