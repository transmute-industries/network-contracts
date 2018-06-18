pragma solidity ^0.4.24;

import "./TransmuteToken.sol";

contract ProviderRound is TransmuteToken {

  struct Delegator {
    address delegatorAddress;
    address delegateAddress;
    uint amountBonded;
  }

  uint public numberOfDelegators;
  mapping(uint => Delegator) public delegators;

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

  function provider(uint _pricePerStorageMineral, uint _pricePerComputeMineral, uint _blockRewardCut, uint _feeShare) public {
    require(0 <= _blockRewardCut && _blockRewardCut <= 100);
    require(0 <= _feeShare && _feeShare <= 100);
    uint providerCandidateId = numberOfProviderCandidates++;
    providerCandidates[providerCandidateId] = Provider(msg.sender, _pricePerStorageMineral, _pricePerComputeMineral, _blockRewardCut, _feeShare, 0);
  }

  function bond(uint _providerCandidateId, uint _amount) public {
    Provider storage providerCandidate = providerCandidates[_providerCandidateId];
    uint delegatorId = numberOfDelegators++;
    delegators[delegatorId] = Delegator(msg.sender, providerCandidate.providerAddress, _amount);
    providerCandidate.totalAmountBonded += _amount;
  }
}
