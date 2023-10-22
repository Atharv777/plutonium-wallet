require('dotenv').config();
const { ethers } = require("ethers")

const { getUserDetails } = require('./firebase');
const { getAllTxns } = require('./getAllTxns');


async function getAllTokens(id, pass) {
    try {

        const userD = await getUserDetails(id)
        const txns = await getAllTxns(id, pass)

        const allOwnedTokens = {}

        if (userD.status === 200) {
            if (txns.status === 200) {

                await txns.data.results.reduce(async (promise1, result) => {
                    await promise1;
                    await result.transfers.reduce(async (promise2, transfer) => {
                        await promise2
                        if (transfer.type === "ERC20_TRANSFER") {
                            if (!allOwnedTokens[transfer.tokenInfo.address]) {
                                const balance = await getBlanceOfToken(transfer.tokenInfo.address, userD.data.safeAddresses[userD.data.currentIndex]);
                                allOwnedTokens[transfer.tokenInfo.address] = { ...transfer.tokenInfo, balance };
                            }
                        }
                    }, Promise.resolve());
                }, Promise.resolve())

                return ({ status: 200, data: allOwnedTokens, msg: "All tokens fetched successfully!" })
            }
            else {
                return (txns)
            }
        }
        else {
            return (userD)
        }
    }
    catch (err) {
        console.log(err)
        return ({ status: 400, data: err, msg: "Unknown error occurred!" })
    }
}

const getBlanceOfToken = async (tokenAddress, address) => {
    const provider = new ethers.providers.JsonRpcProvider(process.env.GOERLI_RPC);
    const abi = [{ constant: true, inputs: [{ name: "_owner", type: "address" }], name: "balanceOf", outputs: [{ name: "balance", type: "uint256" }], type: "function" }];
    const contract = new ethers.Contract(tokenAddress, abi, provider)
    const bal = await contract.balanceOf(address)
    return (ethers.utils.formatEther(parseInt(bal._hex).toString()))
}

module.exports = { getAllTokens }