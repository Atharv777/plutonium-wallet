// https://sepolia.scrollscan.com/address/0x72e7e3f478d1ea36412370db4f068e0b65ae5ef0

export const CONTRACT_ADDRESS = "0x72e7E3F478D1Ea36412370dB4f068e0B65AE5EF0";

export const CONTRACT_ABI = [
	{
		inputs: [
			{
				internalType: "string",
				name: "_userName",
				type: "string",
			},
			{
				internalType: "address",
				name: "_safeAddress",
				type: "address",
			},
			{
				internalType: "string",
				name: "_encryptedData",
				type: "string",
			},
			{
				internalType: "string",
				name: "_userId",
				type: "string",
			},
		],
		name: "addUserDetails",
		outputs: [],
		stateMutability: "nonpayable",
		type: "function",
	},
	{
		inputs: [
			{
				internalType: "string",
				name: "_userName",
				type: "string",
			},
		],
		name: "getEncryptedData",
		outputs: [
			{
				internalType: "string",
				name: "",
				type: "string",
			},
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [
			{
				internalType: "string",
				name: "_userName",
				type: "string",
			},
		],
		name: "getSafeAddress",
		outputs: [
			{
				internalType: "address",
				name: "",
				type: "address",
			},
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [
			{
				internalType: "string",
				name: "_userName",
				type: "string",
			},
		],
		name: "getUserId",
		outputs: [
			{
				internalType: "string",
				name: "",
				type: "string",
			},
		],
		stateMutability: "view",
		type: "function",
	},
];
