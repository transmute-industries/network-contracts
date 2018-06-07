pragma solidity ^0.4.24;

import "./TransmuteToken.sol";

contract ProviderRound is TransmuteToken {

  struct ProviderParameters {
    address providerAddress;
    uint pricePerStorageMineral;
    uint pricePerComputeMineral;
    uint blockRewardCut;
    uint feeShare;
  }

  uint public numberOfProviderCandidates;

  mapping (uint => ProviderParameters) public providerCandidates;

  function provider(uint _pricePerStorageMineral, uint _pricePerComputeMineral, uint _blockRewardCut, uint _feeShare) public {
    require(0 <= _blockRewardCut && _blockRewardCut <= 100);
    require(0 <= _feeShare && _feeShare <= 100);
    uint candidateId = numberOfProviderCandidates++;
    providerCandidates[candidateId] = ProviderParameters(msg.sender, _pricePerStorageMineral, _pricePerComputeMineral, _blockRewardCut, _feeShare);
  }
}
