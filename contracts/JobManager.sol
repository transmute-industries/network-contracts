pragma solidity ^0.4.24;

import "zeppelin-solidity/contracts/math/SafeMath.sol";

contract JobManager {
  using SafeMath for uint;

  event MineralAdded (
    uint id,
    string name
  );

  event JobAdded (
    uint id,
    uint mineralId,
    uint minPricePerMineral,
    uint expirationBlock
  );

  struct Mineral {
    string name;
  }

  struct Job {
    uint mineralId;
    uint minPricePerMineral;
    uint expirationBlock;
  }

  uint public numberOfMinerals;
  mapping(uint => Mineral) public minerals;

  uint public numberOfJobs;
  mapping(uint => Job) public jobs;

  function submitMineral(string _name) external {
    minerals[numberOfMinerals] = Mineral(_name);
    emit MineralAdded(numberOfMinerals, _name);
    numberOfMinerals = numberOfMinerals.add(1);
  }

  function mineralIsValid(uint _mineralId) public view returns (bool) {
    Mineral memory m = minerals[_mineralId];
    return bytes(m.name).length > 0;
  }

  function job(uint _mineralId, uint _minPricePerMineral, uint _expirationBlock) external {
    // mineralId must correspond to an existing mineral
    require(mineralIsValid(_mineralId));
    // expirationBlock must be in the future
    require(_expirationBlock > block.number);

    Job storage j = jobs[numberOfJobs];
    j.mineralId = _mineralId;
    j.minPricePerMineral = _minPricePerMineral;
    j.expirationBlock = _expirationBlock;
    emit JobAdded(numberOfJobs, _mineralId, _minPricePerMineral, _expirationBlock);
    numberOfJobs = numberOfJobs.add(1);
  }
}
