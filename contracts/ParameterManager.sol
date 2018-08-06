pragma solidity ^0.4.24;

contract ParameterManager {
  event ParameterChanged (
    string name,
    uint oldValue,
    uint newValue
  );
}
