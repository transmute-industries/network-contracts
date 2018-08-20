pragma solidity ^0.4.24;

import "./JobManager.sol";

// This contract adds public methods to be able to call internal methods from web3js
contract TestJobManager is JobManager {
  function publicGetPseudoRandomNumber() public view returns (uint) {
    return getPseudoRandomNumber();
  }

  function publicSelectProvider(uint _maxPricePerMineral, MineralCategory _mineralCategory) public view returns (address) {
    return selectProvider(_maxPricePerMineral, _mineralCategory);
  }
}

