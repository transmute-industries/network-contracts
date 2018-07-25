pragma solidity ^0.4.24;

import "zeppelin-solidity/contracts/math/SafeMath.sol";

contract JobManager {
  using SafeMath for uint;

  enum MineralCategory { Null, Compute, Storage }

  event MineralAdded (
    uint id,
    string name,
    address producer,
    MineralCategory category
  );

  event JobAdded (
    uint id,
    uint mineralId,
    uint minPricePerMineral,
    uint expirationBlock
  );

  struct Mineral {
    string name;
    address producer;
    MineralCategory category;
  }

  struct Job {
    uint mineralId;
    uint minPricePerMineral;
    // TODO: Add consumer address
    uint expirationBlock;
  }

  uint public numberOfMinerals;
  mapping(uint => Mineral) public minerals;

  uint public numberOfJobs;
  mapping(uint => Job) public jobs;

  function submitMineral(string _name, uint _category) external {
    // Mineral has to be one of two categories: Compute or Storage
    MineralCategory mc;
    if(_category == uint(MineralCategory.Compute)) {
      mc = MineralCategory.Compute;
    } else if (_category == uint(MineralCategory.Storage)) {
      mc = MineralCategory.Storage;
    } else {
      revert();
    }
    minerals[numberOfMinerals] = Mineral(_name, msg.sender, mc);
    emit MineralAdded(numberOfMinerals, _name, msg.sender, mc);
    numberOfMinerals = numberOfMinerals.add(1);
  }

  function mineralIsValid(uint _mineralId) public view returns (bool) {
    Mineral memory m = minerals[_mineralId];
    return m.producer != address(0);
  }

  function submitJob(uint _mineralId, uint _minPricePerMineral, uint _expirationBlock) external {
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
