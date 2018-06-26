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

  struct Provider {
    address providerAddress;
    uint pricePerStorageMineral;
    uint pricePerComputeMineral;
    uint blockRewardCut;
    uint feeShare;
    uint totalAmountBonded;
  }

  uint public numberOfProviderCandidates;
  mapping(uint => Provider) public providerCandidates;

  function provider(uint _pricePerStorageMineral, uint _pricePerComputeMineral, uint _blockRewardCut, uint _feeShare)
    external onlyBeforeActiveRoundIsLocked
  {
    require(_blockRewardCut <= 100);
    require(_feeShare <= 100);
    uint providerCandidateId = numberOfProviderCandidates;
    numberOfProviderCandidates = numberOfProviderCandidates.add(1);
    providerCandidates[providerCandidateId] = Provider(msg.sender, _pricePerStorageMineral, _pricePerComputeMineral, _blockRewardCut, _feeShare, 0);
  }

  function bond(uint _providerCandidateId, uint _amount) external {
    Provider storage providerCandidate = providerCandidates[_providerCandidateId];
    // Check if _providerCandidateId is associated with an existing providerCandidate
    require(providerCandidate.providerAddress != address(0));
    // Check if delegator has not already bonded to some address
    require(delegators[msg.sender].delegateAddress == address(0));
    this.transferFrom(msg.sender, this, _amount);
    delegators[msg.sender] = Delegator(providerCandidate.providerAddress, _amount);
    providerCandidate.totalAmountBonded = providerCandidate.totalAmountBonded.add(_amount);
  }
}
