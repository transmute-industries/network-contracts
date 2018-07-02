pragma solidity ^0.4.24;

import "./TransmuteToken.sol";
import "./RoundManager.sol";

contract ProviderRound is TransmuteToken, RoundManager {

  event ProviderAdded (
    address indexed _providerAddress,
    uint _pricePerStorageMineral,
    uint _pricePerComputeMineral,
    uint _blockRewardCut,
    uint _feeShare
  );

  event ProviderUpdated (
    address indexed _providerAddress,
    uint _pricePerStorageMineral,
    uint _pricePerComputeMineral,
    uint _blockRewardCut,
    uint _feeShare
  );

  event ProviderResigned (
    address indexed _providerAddress
  );

  struct Delegator {
    address delegateAddress;
    uint amountBonded;
  }

  uint public numberOfDelegators;
  mapping(address => Delegator) public delegators;

  enum ProviderStatus { Null, Registered }

  struct Provider {
    ProviderStatus status;
    uint pricePerStorageMineral;
    uint pricePerComputeMineral;
    uint blockRewardCut;
    uint feeShare;
    uint totalAmountBonded;
  }

  uint public numberOfProviders;
  mapping(address => Provider) public providers;

  function provider(uint _pricePerStorageMineral, uint _pricePerComputeMineral, uint _blockRewardCut, uint _feeShare)
    external onlyBeforeActiveRoundIsLocked
  {
    require(_blockRewardCut <= 100);
    require(_feeShare <= 100);
    Provider storage provider = providers[msg.sender];
    if (provider.status == ProviderStatus.Null) {
      numberOfProviders = numberOfProviders.add(1);
      ProviderAdded(msg.sender, _pricePerStorageMineral, _pricePerComputeMineral, _blockRewardCut, _feeShare);
    } else {
      ProviderUpdated(msg.sender, _pricePerStorageMineral, _pricePerComputeMineral, _blockRewardCut, _feeShare);
    }
    provider.status = ProviderStatus.Registered;
    provider.pricePerStorageMineral = _pricePerStorageMineral;
    provider.pricePerComputeMineral = _pricePerComputeMineral;
    provider.blockRewardCut = _blockRewardCut;
    provider.feeShare = _feeShare;
  }

  function resignAsProvider() public {
    require(providers[msg.sender].status != ProviderStatus.Null);
    delete providers[msg.sender];
    ProviderResigned(msg.sender);
  }

  function bond(address _providerAddress, uint _amount) external {
    Provider storage provider = providers[_providerAddress];
    // Check if _providerAddress is associated with an existing provider
    require(provider.status != ProviderStatus.Null);
    // Check if delegator has not already bonded to some address
    require(delegators[msg.sender].delegateAddress == address(0));
    this.transferFrom(msg.sender, this, _amount);
    delegators[msg.sender] = Delegator(_providerAddress, _amount);
    provider.totalAmountBonded = provider.totalAmountBonded.add(_amount);
  }
}
