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
  mapping(address => Provider) public providers;
}
