pragma solidity ^0.4.24;

import "./TransmuteToken.sol";
import "./RoundManager.sol";

contract ProviderRound is TransmuteToken, RoundManager {

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

  uint public numberOfProviderCandidates;
  mapping(address => Provider) public providerCandidates;

  function provider(uint _pricePerStorageMineral, uint _pricePerComputeMineral, uint _blockRewardCut, uint _feeShare)
    external onlyBeforeActiveRoundIsLocked
  {
    require(_blockRewardCut <= 100);
    require(_feeShare <= 100);
    uint providerCandidateId = numberOfProviderCandidates;
    numberOfProviderCandidates = numberOfProviderCandidates.add(1);
    providerCandidates[msg.sender] = Provider(ProviderStatus.Registered, _pricePerStorageMineral, _pricePerComputeMineral, _blockRewardCut, _feeShare, 0);
  }

  function bond(address _providerAddress, uint _amount) external {
    Provider storage provider = providerCandidates[_providerAddress];
    // Check if _providerAddress is associated with an existing provider
    require(provider.status != ProviderStatus.Null);
    // Check if delegator has not already bonded to some address
    require(delegators[msg.sender].delegateAddress == address(0));
    this.transferFrom(msg.sender, this, _amount);
    delegators[msg.sender] = Delegator(_providerAddress, _amount);
    provider.totalAmountBonded = provider.totalAmountBonded.add(_amount);
  }
}
