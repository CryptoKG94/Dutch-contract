use {
    borsh::{BorshDeserialize, BorshSerialize},
    solana_program::{
        account_info::AccountInfo, borsh::try_from_slice_unchecked, program_error::ProgramError,
        pubkey::Pubkey,
    },
    std::str::FromStr,
};

use thiserror::Error;

pub fn try_from_slice_checked<T: BorshDeserialize>(
    data: &[u8],
    data_type: Key,
    data_size: usize,
) -> Result<T, ProgramError> {
    if data.len() == 0 {
        return Err(EscrowError::MissingMetadata.into());
    }
    if (data[0] != data_type as u8 && data[0] != Key::Uninitialized as u8)
        || data.len() != data_size
    {
        return Err(EscrowError::InvalidMetadata.into());
    }

    let result: T = try_from_slice_unchecked(data)?;

    Ok(result)
}

#[repr(C)]
#[derive(Clone, BorshSerialize, BorshDeserialize, Debug)]
pub struct Metadata {
    pub key: Key,
    pub update_authority: Pubkey,
    pub mint: Pubkey,
    pub data: Data,
    // Immutable, once flipped, all sales of this metadata are considered secondary.
    pub primary_sale_happened: bool,
    // Whether or not the data struct is mutable, default is not
    pub is_mutable: bool,
}

impl Metadata {
    pub fn from_account_info(a: &AccountInfo) -> Result<Metadata, ProgramError> {
        Metadata::from_u8(&a.data.borrow_mut())
    }

    pub fn from_u8(u: &[u8]) -> Result<Metadata, ProgramError> {
        let md: Metadata = try_from_slice_checked(&u, Key::MetadataV1, MAX_METADATA_LEN)?;
        Ok(md)
    }
}

pub const MAX_CREATOR_LIMIT: usize = 5;

pub const MAX_CREATOR_LEN: usize = 32 + 1 + 1;

pub const MAX_NAME_LENGTH: usize = 32;

pub const MAX_SYMBOL_LENGTH: usize = 10;

pub const MAX_URI_LENGTH: usize = 200;

pub const MAX_METADATA_LEN: usize = 1
    + 32
    + 32
    + MAX_NAME_LENGTH
    + MAX_SYMBOL_LENGTH
    + MAX_URI_LENGTH
    + MAX_CREATOR_LIMIT * MAX_CREATOR_LEN
    + 2
    + 1
    + 1
    + 198;

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone, Copy)]
pub enum Key {
    Uninitialized,
    EditionV1,
    MasterEditionV1,
    ReservationListV1,
    MetadataV1,
    ReservationListV2,
    MasterEditionV2,
    EditionMarker,
}

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct Creator {
    pub address: Pubkey,
    pub verified: bool,
    // In percentages, NOT basis points ;) Watch out!
    pub share: u8,
}

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct Data {
    /// The name of the asset
    pub name: String,
    /// The symbol for the asset
    pub symbol: String,
    /// URI pointing to JSON representing the asset
    pub uri: String,
    /// Royalty basis points that goes to creators in secondary sales (0-10000)
    pub seller_fee_basis_points: u16,
    /// Array of creators, optional
    pub creators: Option<Vec<Creator>>,
}

pub const PREFIX: &str = "metadata";
pub const METAPLEX: &str = "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";

pub fn get_metadata_account(mint: &Pubkey) -> Pubkey {
    let program_key = Pubkey::from_str(METAPLEX).unwrap();
    let metadata_seeds = &[PREFIX.as_bytes(), &program_key.as_ref(), mint.as_ref()];
    let (metadata_key, _nonce) = Pubkey::find_program_address(metadata_seeds, &program_key);
    metadata_key
}

#[derive(Error, Debug, Copy, Clone)]
pub enum EscrowError {
    #[error("Invalid Instruction")]
    InvalidInstruction,

    #[error("Not Rent Exempt")]
    NotRentExempt,

    #[error("Expected Amount Mismatch")]
    ExpectedAmountMismatch,

    #[error("Amount Overflow")]
    AmountOverflow,

    #[error("Invalid sales tax recipient")]
    InvalidSalesTaxRecipient,

    #[error("Numeric Conversion Failed")]
    NumericConversionFailed,

    #[error("Invalid mint account")]
    InvalidMintAccount,

    #[error("Invalid token amount (needs to be exactly 1)")]
    InvalidTokenAmount,

    #[error("Invalid metadata")]
    InvalidMetadata,

    #[error("Missing metadata")]
    MissingMetadata,

    #[error("Invalid final amount")]
    InvalidFinalAmount,

    #[error("Royalty percentage too high")]
    InvalidRoyaltyFee,

    #[error("Creator mismatch")]
    CreatorMismatch,
}

impl From<EscrowError> for ProgramError {
    fn from(e: EscrowError) -> Self {
        ProgramError::Custom(e as u32)
    }
}
