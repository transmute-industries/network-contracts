pragma solidity ^0.4.24;

import "zeppelin-solidity/contracts/math/SafeMath.sol";

contract JobManager {
  using SafeMath for uint;

  event MineralAdded (
    uint id,
    string name
  );

  struct Mineral {
    string name;
  }

  uint public numberOfMinerals;
  mapping(uint => Mineral) public minerals;

  function submitMineral(string _name) external {
    minerals[numberOfMinerals] = Mineral(_name);
    emit MineralAdded(numberOfMinerals, _name);
    numberOfMinerals = numberOfMinerals.add(1);
  }
}
