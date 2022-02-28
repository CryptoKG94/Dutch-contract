import {
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
} from "@solana/web3.js";
import { programIds, findProgramAddress } from "./ids";
import { serialize } from "borsh";
import { deserializeBorsh } from "./borsh";
import BN from "bn.js";
export const METADATA_PREFIX = "metadata";
export const EDITION = "edition";
export const RESERVATION = "reservation";

export const MAX_NAME_LENGTH = 32;

export const MAX_SYMBOL_LENGTH = 10;

export const MAX_URI_LENGTH = 200;

export const MAX_CREATOR_LIMIT = 5;

export const MAX_CREATOR_LEN = 32 + 1 + 1;

export const MAX_METADATA_LEN =
  1 +
  32 +
  32 +
  MAX_NAME_LENGTH +
  MAX_SYMBOL_LENGTH +
  MAX_URI_LENGTH +
  MAX_CREATOR_LIMIT * MAX_CREATOR_LEN +
  1 +
  1 +
  200;

export const MAX_MASTER_EDITION_KEN = 1 + 9 + 8 + 32 + 32;

export enum MetadataKey {
  Uninitialized = 0,
  MetadataV1 = 4,
  EditionV1 = 1,
  MasterEditionV1 = 2,
  MasterEditionV2 = 6,
  ReservationListV1 = 3,
}

export enum MetadataCategory {
  Audio = "audio",
  Video = "video",
  Image = "image",
  VR = "vr",
}

export type MetadataFile = {
  uri: string;
  type: string;
};

export type FileOrString = MetadataFile | string;

export interface IMetadataExtension {
  name: string;
  symbol: string;

  creators: Creator[] | null;
  description: string;
  // preview image absolute URI
  image: string;
  animation_url?: string;

  // stores link to item on meta
  external_url: string;

  seller_fee_basis_points: number;

  properties: {
    files?: FileOrString[];
    category: MetadataCategory;
    maxSupply?: number;
    creators?: {
      address: string;
      shares: number;
    }[];
  };
}

export class MasterEditionV2 {
  key: MetadataKey;
  supply: BN;
  maxSupply?: BN;

  constructor(args: { key: MetadataKey; supply: BN; maxSupply?: BN }) {
    this.key = MetadataKey.MasterEditionV2;
    this.supply = args.supply;
    this.maxSupply = args.maxSupply;
  }
}

export class Edition {
  key: MetadataKey;
  /// Points at MasterEdition struct
  parent: PublicKey;
  /// Starting at 0 for master record, this is incremented for each edition minted.
  edition: BN;

  constructor(args: { key: MetadataKey; parent: PublicKey; edition: BN }) {
    this.key = MetadataKey.EditionV1;
    this.parent = args.parent;
    this.edition = args.edition;
  }
}
export class Reservation {
  address: PublicKey;
  spotsRemaining: number;
  totalSpots: number;
  constructor(args: {
    address: PublicKey;
    spotsRemaining: number;
    totalSpots: number;
  }) {
    this.address = args.address;
    this.spotsRemaining = args.spotsRemaining;
    this.totalSpots = args.totalSpots;
  }
}

export class ReservationList {
  key: MetadataKey = MetadataKey.ReservationListV1;
  /// Present for reverse lookups
  masterEdition: PublicKey;

  /// What supply counter was on master_edition when this reservation was created.
  supplySnapshot: BN | null;
  reservations: Reservation[];
  totalReservationSpots: BN;

  constructor(args: {
    key: MetadataKey;
    masterEdition: PublicKey;
    supplySnapshot: BN | null;
    reservations: Reservation[];
    totalReservationSpots: BN;
  }) {
    this.key = MetadataKey.EditionV1;
    this.masterEdition = args.masterEdition;
    this.supplySnapshot = args.supplySnapshot;
    this.reservations = args.reservations;
    this.totalReservationSpots = args.totalReservationSpots;
  }
}

export class Creator {
  address: PublicKey;
  verified: boolean;
  share: number;

  constructor(args: { address: PublicKey; verified: boolean; share: number }) {
    this.address = args.address;
    this.verified = args.verified;
    this.share = args.share;
  }
}

export class Data {
  name: string;
  symbol: string;
  uri: string;
  sellerFeeBasisPoints: number;
  creators: Creator[] | null;
  constructor(args: {
    name: string;
    symbol: string;
    uri: string;
    sellerFeeBasisPoints: number;
    creators: Creator[] | null;
  }) {
    this.name = args.name;
    this.symbol = args.symbol;
    this.uri = args.uri;
    this.sellerFeeBasisPoints = args.sellerFeeBasisPoints;
    this.creators = args.creators;
  }
}

export class Metadata {
  key: MetadataKey;
  updateAuthority: PublicKey;
  mint: PublicKey;
  data: Data;
  primarySaleHappened: boolean;
  isMutable: boolean;

  // set lazy
  masterEdition?: PublicKey;
  edition?: PublicKey;

  constructor(args: {
    updateAuthority: PublicKey;
    mint: PublicKey;
    data: Data;
    primarySaleHappened: boolean;
    isMutable: boolean;
  }) {
    this.key = MetadataKey.MetadataV1;
    this.updateAuthority = args.updateAuthority;
    this.mint = args.mint;
    this.data = args.data;
    this.primarySaleHappened = args.primarySaleHappened;
    this.isMutable = args.isMutable;
  }

  public async init() {
    const edition = await getEdition(this.mint);
    this.edition = edition;
    this.masterEdition = edition;
  }
}

class CreateMetadataArgs {
  instruction: number = 0;
  data: Data;
  isMutable: boolean;

  constructor(args: { data: Data; isMutable: boolean }) {
    this.data = args.data;
    this.isMutable = args.isMutable;
  }
}
class UpdateMetadataArgs {
  instruction: number = 1;
  data: Data | null;
  // Not used by this app, just required for instruction
  updateAuthority: PublicKey | null;
  primarySaleHappened: boolean | null;
  constructor(args: {
    data?: Data;
    updateAuthority?: string;
    primarySaleHappened: boolean | null;
  }) {
    this.data = args.data ? args.data : null;
    this.updateAuthority = args.updateAuthority
      ? new PublicKey(args.updateAuthority)
      : null;
    this.primarySaleHappened = args.primarySaleHappened;
  }
}

class CreateMasterEditionArgs {
  instruction: number = 10;
  maxSupply: BN | null;
  constructor(args: { maxSupply: BN | null }) {
    this.maxSupply = args.maxSupply;
  }
}

class MintPrintingTokensArgs {
  instruction: number = 9;
  supply: BN;

  constructor(args: { supply: BN }) {
    this.supply = args.supply;
  }
}

export const METADATA_SCHEMA = new Map<any, any>([
  [
    CreateMetadataArgs,
    {
      kind: "struct",
      fields: [
        ["instruction", "u8"],
        ["data", Data],
        ["isMutable", "u8"], // bool
      ],
    },
  ],
  [
    UpdateMetadataArgs,
    {
      kind: "struct",
      fields: [
        ["instruction", "u8"],
        ["data", { kind: "option", type: Data }],
        ["updateAuthority", { kind: "option", type: "pubkey" }],
        ["primarySaleHappened", { kind: "option", type: "u8" }],
      ],
    },
  ],

  [
    CreateMasterEditionArgs,
    {
      kind: "struct",
      fields: [
        ["instruction", "u8"],
        ["maxSupply", { kind: "option", type: "u64" }],
      ],
    },
  ],
  [
    MintPrintingTokensArgs,
    {
      kind: "struct",
      fields: [
        ["instruction", "u8"],
        ["supply", "u64"],
      ],
    },
  ],
  [
    MasterEditionV2,
    {
      kind: "struct",
      fields: [
        ["key", "u8"],
        ["supply", "u64"],
        ["maxSupply", { kind: "option", type: "u64" }],
      ],
    },
  ],
  [
    Edition,
    {
      kind: "struct",
      fields: [
        ["key", "u8"],
        ["parent", "pubkey"],
        ["edition", "u64"],
      ],
    },
  ],
  [
    Data,
    {
      kind: "struct",
      fields: [
        ["name", "string"],
        ["symbol", "string"],
        ["uri", "string"],
        ["sellerFeeBasisPoints", "u16"],
        ["creators", { kind: "option", type: [Creator] }],
      ],
    },
  ],
  [
    Creator,
    {
      kind: "struct",
      fields: [
        ["address", "pubkey"],
        ["verified", "u8"],
        ["share", "u8"],
      ],
    },
  ],
  [
    Metadata,
    {
      kind: "struct",
      fields: [
        ["key", "u8"],
        ["updateAuthority", "pubkey"],
        ["mint", "pubkey"],
        ["data", Data],
        ["primarySaleHappened", "u8"], // bool
        ["isMutable", "u8"], // bool
      ],
    },
  ],
  [
    Reservation,
    {
      kind: "struct",
      fields: [
        ["address", "pubkey"],
        ["spotsRemaining", "u8"],
        ["totalSpots", "u8"],
      ],
    },
  ],
  [
    ReservationList,
    {
      kind: "struct",
      fields: [
        ["key", "u8"],
        ["masterEdition", "pubkey"],
        ["supplySnapshot", { kind: "option", type: "u64" }],
        ["reservations", [Reservation]],
        ["totalReservationSpots", "u64"],
      ],
    },
  ],
]);

export const decodeMetadata = (buffer: Buffer): Metadata => {
  const metadata = deserializeBorsh(
    METADATA_SCHEMA,
    Metadata,
    buffer
  ) as Metadata;
  return metadata;
};

export const decodeEdition = (buffer: Buffer) => {
  return deserializeBorsh(METADATA_SCHEMA, Edition, buffer) as Edition;
};

export const decodeMasterEdition = (buffer: Buffer): MasterEditionV2 => {
  return deserializeBorsh(
    METADATA_SCHEMA,
    MasterEditionV2,
    buffer
  ) as MasterEditionV2;
};

export async function updateMetadata(
  data: Data | undefined,
  newUpdateAuthority: string | undefined,
  primarySaleHappened: boolean | null | undefined,
  mintKey: PublicKey,
  updateAuthority: PublicKey,
  instructions: TransactionInstruction[],
  metadataAccount?: PublicKey
) {
  const metadataProgramId = programIds().metadata;

  metadataAccount =
    metadataAccount ||
    (
      await findProgramAddress(
        [
          Buffer.from("metadata"),
          metadataProgramId.toBuffer(),
          mintKey.toBuffer(),
        ],
        metadataProgramId
      )
    )[0];

  const value = new UpdateMetadataArgs({
    data,
    updateAuthority: !newUpdateAuthority ? undefined : newUpdateAuthority,
    primarySaleHappened:
      primarySaleHappened === null || primarySaleHappened === undefined
        ? null
        : primarySaleHappened,
  });
  const txnData = Buffer.from(serialize(METADATA_SCHEMA, value));
  const keys = [
    {
      pubkey: metadataAccount,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: updateAuthority,
      isSigner: true,
      isWritable: false,
    },
  ];
  instructions.push(
    new TransactionInstruction({
      keys,
      programId: metadataProgramId,
      data: txnData,
    })
  );

  return metadataAccount;
}

export async function createMetadata(
  data: Data,
  updateAuthority: PublicKey,
  mintKey: PublicKey,
  mintAuthorityKey: PublicKey,
  instructions: TransactionInstruction[],
  payer: PublicKey
) {
  const metadataProgramId = programIds().metadata;

  const metadataAccount = (
    await findProgramAddress(
      [
        Buffer.from("metadata"),
        metadataProgramId.toBuffer(),
        mintKey.toBuffer(),
      ],
      metadataProgramId
    )
  )[0];
  console.log("Data", data);
  const value = new CreateMetadataArgs({ data, isMutable: true });
  const txnData = Buffer.from(serialize(METADATA_SCHEMA, value));

  const keys = [
    {
      pubkey: metadataAccount,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: mintKey,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: mintAuthorityKey,
      isSigner: true,
      isWritable: false,
    },
    {
      pubkey: payer,
      isSigner: true,
      isWritable: false,
    },
    {
      pubkey: updateAuthority,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: SYSVAR_RENT_PUBKEY,
      isSigner: false,
      isWritable: false,
    },
  ];
  instructions.push(
    new TransactionInstruction({
      keys,
      programId: metadataProgramId,
      data: txnData,
    })
  );

  return metadataAccount;
}

export async function createMasterEdition(
  maxSupply: BN | undefined,
  mintKey: PublicKey,
  updateAuthorityKey: PublicKey,
  mintAuthorityKey: PublicKey,
  payer: PublicKey,
  instructions: TransactionInstruction[]
) {
  const metadataProgramId = programIds().metadata;

  const metadataAccount = (
    await findProgramAddress(
      [
        Buffer.from(METADATA_PREFIX),
        metadataProgramId.toBuffer(),
        mintKey.toBuffer(),
      ],
      metadataProgramId
    )
  )[0];

  const editionAccount = (
    await findProgramAddress(
      [
        Buffer.from(METADATA_PREFIX),
        metadataProgramId.toBuffer(),
        mintKey.toBuffer(),
        Buffer.from(EDITION),
      ],
      metadataProgramId
    )
  )[0];

  const value = new CreateMasterEditionArgs({ maxSupply: maxSupply || null });
  const data = Buffer.from(serialize(METADATA_SCHEMA, value));

  const keys = [
    {
      pubkey: editionAccount,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: mintKey,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: updateAuthorityKey,
      isSigner: true,
      isWritable: false,
    },
    {
      pubkey: mintAuthorityKey,
      isSigner: true,
      isWritable: false,
    },
    {
      pubkey: payer,
      isSigner: true,
      isWritable: false,
    },
    {
      pubkey: metadataAccount,
      isSigner: false,
      isWritable: false,
    },

    {
      pubkey: programIds().token,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: SYSVAR_RENT_PUBKEY,
      isSigner: false,
      isWritable: false,
    },
  ];

  instructions.push(
    new TransactionInstruction({
      keys,
      programId: new PublicKey(metadataProgramId),
      data,
    })
  );
}

export async function mintNewEditionFromMasterEditionViaToken(
  newMint: PublicKey,
  tokenMint: PublicKey,
  newMintAuthority: PublicKey,
  printingMint: PublicKey,
  authorizationTokenHoldingAccount: PublicKey,
  burnAuthority: PublicKey,
  updateAuthorityOfMaster: PublicKey,
  reservationList: PublicKey | undefined,
  instructions: TransactionInstruction[],
  payer: PublicKey
) {
  const metadataProgramId = programIds().metadata;

  const newMetadataKey = await getMetadata(newMint);
  const masterMetadataKey = await getMetadata(tokenMint);
  const newEdition = await getEdition(newMint);
  const masterEdition = await getEdition(tokenMint);

  const data = Buffer.from([3]);

  const keys = [
    {
      pubkey: newMetadataKey,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: newEdition,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: masterEdition,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: newMint,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: newMintAuthority,
      isSigner: true,
      isWritable: false,
    },
    {
      pubkey: printingMint,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: authorizationTokenHoldingAccount,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: burnAuthority,
      isSigner: true,
      isWritable: false,
    },
    {
      pubkey: payer,
      isSigner: true,
      isWritable: false,
    },
    {
      pubkey: updateAuthorityOfMaster,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: masterMetadataKey,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: programIds().token,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: SYSVAR_RENT_PUBKEY,
      isSigner: false,
      isWritable: false,
    },
  ];

  if (reservationList) {
    keys.push({
      pubkey: reservationList,
      isSigner: false,
      isWritable: true,
    });
  }
  instructions.push(
    new TransactionInstruction({
      keys,
      programId: metadataProgramId,
      data,
    })
  );
}

export async function updatePrimarySaleHappenedViaToken(
  metadata: PublicKey,
  owner: PublicKey,
  tokenAccount: PublicKey,
  instructions: TransactionInstruction[]
) {
  const metadataProgramId = programIds().metadata;

  const data = Buffer.from([4]);

  const keys = [
    {
      pubkey: metadata,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: owner,
      isSigner: true,
      isWritable: false,
    },
    {
      pubkey: tokenAccount,
      isSigner: false,
      isWritable: false,
    },
  ];
  instructions.push(
    new TransactionInstruction({
      keys,
      programId: metadataProgramId,
      data,
    })
  );
}

export async function createReservationList(
  metadata: PublicKey,
  masterEdition: PublicKey,
  resource: PublicKey,
  updateAuthority: PublicKey,
  payer: PublicKey,
  instructions: TransactionInstruction[]
) {
  const metadataProgramId = programIds().metadata;

  const reservationList = await getReservationList(masterEdition, resource);
  const data = Buffer.from([6]);

  const keys = [
    {
      pubkey: reservationList,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: payer,
      isSigner: true,
      isWritable: false,
    },
    {
      pubkey: updateAuthority,
      isSigner: true,
      isWritable: false,
    },

    {
      pubkey: masterEdition,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: resource,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: metadata,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: SYSVAR_RENT_PUBKEY,
      isSigner: false,
      isWritable: false,
    },
  ];
  instructions.push(
    new TransactionInstruction({
      keys,
      programId: metadataProgramId,
      data,
    })
  );
}

export async function signMetadata(
  metadata: PublicKey,
  creator: PublicKey,
  instructions: TransactionInstruction[]
) {
  const metadataProgramId = programIds().metadata;

  const data = Buffer.from([7]);

  const keys = [
    {
      pubkey: metadata,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: creator,
      isSigner: true,
      isWritable: false,
    },
  ];
  instructions.push(
    new TransactionInstruction({
      keys,
      programId: metadataProgramId,
      data,
    })
  );
}

export async function mintPrintingTokens(
  destination: PublicKey,
  printingMint: PublicKey,
  updateAuthority: PublicKey,
  metadata: PublicKey,
  masterEdition: PublicKey,
  supply: BN,
  instructions: TransactionInstruction[]
) {
  const PROGRAM_IDS = programIds();
  const metadataProgramId = PROGRAM_IDS.metadata;

  const value = new MintPrintingTokensArgs({ supply });
  const data = Buffer.from(serialize(METADATA_SCHEMA, value));

  const keys = [
    {
      pubkey: destination,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: printingMint,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: updateAuthority,
      isSigner: true,
      isWritable: false,
    },
    {
      pubkey: metadata,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: masterEdition,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: PROGRAM_IDS.token,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: SYSVAR_RENT_PUBKEY,
      isSigner: false,
      isWritable: false,
    },
  ];
  instructions.push(
    new TransactionInstruction({
      keys,
      programId: metadataProgramId,
      data,
    })
  );
}

export async function getEdition(tokenMint: PublicKey): Promise<PublicKey> {
  const PROGRAM_IDS = programIds();

  return (
    await findProgramAddress(
      [
        Buffer.from(METADATA_PREFIX),
        PROGRAM_IDS.metadata.toBuffer(),
        tokenMint.toBuffer(),
        Buffer.from(EDITION),
      ],
      PROGRAM_IDS.metadata
    )
  )[0];
}

export async function getMetadata(tokenMint: PublicKey): Promise<PublicKey> {
  const PROGRAM_IDS = programIds();

  return (
    await findProgramAddress(
      [
        Buffer.from(METADATA_PREFIX),
        PROGRAM_IDS.metadata.toBuffer(),
        tokenMint.toBuffer(),
      ],
      PROGRAM_IDS.metadata
    )
  )[0];
}

export async function getReservationList(
  masterEdition: PublicKey,
  resource: PublicKey
): Promise<PublicKey> {
  const PROGRAM_IDS = programIds();

  return (
    await findProgramAddress(
      [
        Buffer.from(METADATA_PREFIX),
        PROGRAM_IDS.metadata.toBuffer(),
        masterEdition.toBuffer(),
        Buffer.from(RESERVATION),
        resource.toBuffer(),
      ],
      PROGRAM_IDS.metadata
    )
  )[0];
}

// import {PublicKey} from '@solana/web3.js';
// import {getConnection} from './solana/utils';
// import {getMetadata, decodeMetadata} from './solana/metadata';

// const res = await connection.getParsedTokenAccountsByOwner(
//   new PublicKey('4zjmyu2gCLb1HVQfb8vf9xHwprPy4zbvgVzz661FMCa9'),
//   {programId: TOKEN_PROGRAM_ID},
// );
// const mint = res.value[0].account.data.parsed.info.mint;
// const metadataAddr = await getMetadata(new PublicKey(mint));
// console.log(metadataAddr.toString());
// let connection = await getConnection(DEV_URL);
// let accountInfo = await connection.getAccountInfo(
//   new PublicKey(metadataAddr),
// );
// let metadata = decodeMetadata(accountInfo!.data);
// console.log(metadata.data.uri);
