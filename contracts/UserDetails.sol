// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

contract Plutonium {
    struct User {
        address safeAddress;
        string encryptedData;
        string userId;
        string userName;
    }

    //Mapping username to user Details

    mapping(string => User) users;

    function addUserDetails(
        string memory _userName,
        address _safeAddress,
        string memory _encryptedData,
        string memory _userId
    ) public {
        users[_userName].safeAddress = _safeAddress;

        users[_userName].encryptedData = _encryptedData;

        users[_userName].userId = _userId;
    }

    function getSafeAddress(
        string memory _userName
    ) public view returns (address) {
        return users[_userName].safeAddress;
    }

    function getDob(
        string memory _userName
    ) public view returns (string memory) {
        return users[_userName].encryptedData;
    }

    function getAadhaar(
        string memory _userName
    ) public view returns (string memory) {
        return users[_userName].userId;
    }
}
