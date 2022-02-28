export type DutchAuctionIDL = {"version":"0.0.0","name":"dutch_auction","instructions":[{"name":"initEscrow","accounts":[{"name":"initializer","isMut":true,"isSigner":true},{"name":"tokenAccount","isMut":true,"isSigner":false},{"name":"mintAccount","isMut":false,"isSigner":false},{"name":"escrowAccount","isMut":true,"isSigner":false},{"name":"salesTaxRecipient","isMut":true,"isSigner":false},{"name":"systemProgram","isMut":false,"isSigner":false},{"name":"rent","isMut":false,"isSigner":false},{"name":"tokenProgram","isMut":false,"isSigner":false},{"name":"clock","isMut":false,"isSigner":false}],"args":[{"name":"startingPrice","type":"u64"},{"name":"reservedPrice","type":"u64"},{"name":"priceStep","type":"u64"},{"name":"interval","type":"u64"}]},{"name":"dutchAuction","accounts":[{"name":"taker","isMut":true,"isSigner":true},{"name":"takerTokenAccount","isMut":true,"isSigner":false},{"name":"initializer","isMut":true,"isSigner":false},{"name":"initializerTokenAccount","isMut":true,"isSigner":false},{"name":"mintAccount","isMut":false,"isSigner":false},{"name":"escrowAccount","isMut":true,"isSigner":false},{"name":"salesTaxRecipient","isMut":true,"isSigner":false},{"name":"tokenAuthority","isMut":false,"isSigner":false},{"name":"metadataAccount","isMut":false,"isSigner":false},{"name":"systemProgram","isMut":false,"isSigner":false},{"name":"tokenProgram","isMut":false,"isSigner":false},{"name":"clock","isMut":false,"isSigner":false},{"name":"creators","isMut":false,"isSigner":false}],"args":[]}],"accounts":[{"name":"escrowAccount","type":{"kind":"struct","fields":[{"name":"initializerPubkey","type":"publicKey"},{"name":"mintPubkey","type":"publicKey"},{"name":"tokenAccountPubkey","type":"publicKey"},{"name":"startingPrice","type":"u64"},{"name":"reservedPrice","type":"u64"},{"name":"priceStep","type":"u64"},{"name":"interval","type":"u64"},{"name":"startingTs","type":"i64"}]}}],"types":[{"name":"Key","type":{"kind":"enum","variants":[{"name":"Uninitialized"},{"name":"EditionV1"},{"name":"MasterEditionV1"},{"name":"ReservationListV1"},{"name":"MetadataV1"},{"name":"ReservationListV2"},{"name":"MasterEditionV2"},{"name":"EditionMarker"}]}},{"name":"EscrowError","type":{"kind":"enum","variants":[{"name":"InvalidInstruction"},{"name":"NotRentExempt"},{"name":"ExpectedAmountMismatch"},{"name":"AmountOverflow"},{"name":"InvalidSalesTaxRecipient"},{"name":"NumericConversionFailed"},{"name":"InvalidMintAccount"},{"name":"InvalidTokenAmount"},{"name":"InvalidMetadata"},{"name":"MissingMetadata"},{"name":"InvalidFinalAmount"},{"name":"InvalidRoyaltyFee"},{"name":"CreatorMismatch"}]}}],"metadata":{"address":"Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS"}};
import { IdlAccounts } from '@project-serum/anchor';

export type Key = Record<string, Record<string, any>>
export const Key = {
  Uninitialized: { uninitialized: {} },
  EditionV1: { editionv1: {} },
  MasterEditionV1: { mastereditionv1: {} },
  ReservationListV1: { reservationlistv1: {} },
  MetadataV1: { metadatav1: {} },
  ReservationListV2: { reservationlistv2: {} },
  MasterEditionV2: { mastereditionv2: {} },
  EditionMarker: { editionmarker: {} }
}
    

export type EscrowError = Record<string, Record<string, any>>
export const EscrowError = {
  InvalidInstruction: { invalidinstruction: {} },
  NotRentExempt: { notrentexempt: {} },
  ExpectedAmountMismatch: { expectedamountmismatch: {} },
  AmountOverflow: { amountoverflow: {} },
  InvalidSalesTaxRecipient: { invalidsalestaxrecipient: {} },
  NumericConversionFailed: { numericconversionfailed: {} },
  InvalidMintAccount: { invalidmintaccount: {} },
  InvalidTokenAmount: { invalidtokenamount: {} },
  InvalidMetadata: { invalidmetadata: {} },
  MissingMetadata: { missingmetadata: {} },
  InvalidFinalAmount: { invalidfinalamount: {} },
  InvalidRoyaltyFee: { invalidroyaltyfee: {} },
  CreatorMismatch: { creatormismatch: {} }
}
    

  

export type EscrowAccount = IdlAccounts<DutchAuctionIDL>["escrowAccount"]
  
          