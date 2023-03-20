import { Box, Card, CircularProgress, Stack, styled, Typography } from '@mui/material'
import Back from 'components/Back'
import theme from 'theme'
import Input from 'components/Input'
import { BlackButton } from 'components/Button/Button'
import { useCallback, useMemo, useState } from 'react'
import TransactionList from './TransactionList'
import icon from 'assets/images/placeholder.png'
import { useHistory, useParams } from 'react-router-dom'
import ReactHtmlParser from 'react-html-parser'
import { currentTimeStamp, getTargetTimeString } from 'utils'
import {
  PublicSaleListBaseProp,
  usePublicSaleBaseList,
  usePublicSaleTransactionList
} from 'hooks/useBackedPublicSaleServer'
import { useCurrencyBalance, useToken } from 'state/wallet/hooks'
import { escapeAttrValue } from 'xss'
import {
  SwapStatus,
  useCancelSaleCallback,
  useGetSalesInfo,
  usePurchaseCallback
} from 'hooks/useCreatePublicSaleCallback'
import TransactiontionSubmittedModal from 'components/Modal/TransactionModals/TransactiontionSubmittedModal'
import MessageBox from 'components/Modal/TransactionModals/MessageBox'
import { BigNumber } from 'bignumber.js'
import useModal from 'hooks/useModal'
import { TokenAmount } from 'constants/token'
import JSBI from 'jsbi'
import { timeStampToFormat } from 'utils/dao'
import TransacitonPendingModal from 'components/Modal/TransactionModals/TransactionPendingModal'
// import { getTokenPrices } from 'utils/fetch/server'
import { useActiveWeb3React } from 'hooks'
import { ApprovalState, useApproveCallback } from 'hooks/useApproveCallback'
import { tryParseAmount } from 'utils/parseAmount'
import { PUBLICSALE_ADDRESS } from '../../constants'
import { ChainId } from 'constants/chain'
import { routes } from 'constants/routes'

enum Tabs {
  ABOUT,
  TRASACTION
}

export const SwapStatusText = {
  [SwapStatus.SOON]: 'soon',
  [SwapStatus.OPEN]: 'normal',
  [SwapStatus.ENDED]: 'ended',
  [SwapStatus.CANCEL]: 'cancel'
}

const tabs = [
  { name: 'About', value: Tabs.ABOUT },
  { name: 'Transaction', value: Tabs.TRASACTION }
]

const RowSentence = styled('p')(({}) => ({
  display: 'flex',
  justifyContent: 'space-between',
  flexDirection: 'row'
}))

const CardWrapper = styled(Card)(({ theme }) => ({
  border: '1px solid',
  borderRadius: 10,
  padding: 10,
  borderColor: theme.bgColor.bg2,
  display: 'flex',
  flexDirection: 'row',
  justifyContent: 'flex-start',
  alignItems: 'center',
  '& img': {
    width: 80
  },
  '& div': {
    textAlign: 'left',
    display: 'flex',
    justifyContent: 'flex-start',
    flexDirection: 'column'
  },
  '& .iconList': {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-start'
  },
  '& .iconList img': {
    width: 30
  }
}))

const ColSentence = styled('div')(() => ({
  display: 'flex',
  justifyContent: 'flex-start',
  flexDirection: 'column',
  '& p': {
    fontSize: 16,
    color: '#000'
  },
  '& p:first-of-type': {
    fontSize: 12,
    color: '#808191'
  }
}))

const imgDataList = [icon, icon, icon, icon]

export default function Details() {
  const { saleId } = useParams<{ saleId: string }>()
  const { account, chainId } = useActiveWeb3React()
  const [curTab, setCurTab] = useState(Tabs.ABOUT)
  const [salesAmount, setSalesAmount] = useState('')
  const [swapAmount, setSwapAmount] = useState('')
  const history = useHistory()
  const purchaseCallback = usePurchaseCallback()
  const cancelSaleCallback = useCancelSaleCallback()
  const { showModal, hideModal } = useModal()
  const salesInfo = useGetSalesInfo(saleId)

  console.log(salesInfo)
  const progress = useMemo(() => {
    if (!salesInfo) return
    const res = Number(
      new BigNumber(Number(salesInfo?.soldAmount))
        .div(new BigNumber(Number(salesInfo?.saleAmount)))
        .toFixed(6, BigNumber.ROUND_DOWN)
    )
    return res
  }, [salesInfo])

  const { ListLoading, listRes, listPage } = usePublicSaleTransactionList(saleId)
  const { result } = usePublicSaleBaseList(saleId)
  const SwapData: PublicSaleListBaseProp = result[0]
  const saleToken = useToken(SwapData?.saleToken, SwapData?.chainId)
  const receiveToken = useToken(SwapData?.receiveToken, SwapData?.chainId)
  console.log(SwapData)
  const totalAmount = useMemo(() => {
    if (!salesInfo || !saleToken || !receiveToken) return
    const res = new TokenAmount(saleToken, JSBI.BigInt(salesInfo.saleAmount)).multiply(
      new TokenAmount(receiveToken, JSBI.BigInt(salesInfo.pricePer))
    )
    return res
  }, [receiveToken, saleToken, salesInfo])
  const inputValueAmount = tryParseAmount(salesAmount, saleToken || undefined)

  const handlePay = useCallback(() => {
    if (!account || !inputValueAmount || !saleId) return
    showModal(<TransacitonPendingModal />)
    purchaseCallback(account, inputValueAmount.raw.toString(), saleId)
      .then(hash => {
        hideModal()
        showModal(<TransactiontionSubmittedModal hash={hash} hideFunc={() => history.push(routes.SaleList)} />)
      })
      .catch((err: any) => {
        hideModal()
        showModal(
          <MessageBox type="error">
            {err?.data?.message || err?.error?.message || err?.message || 'unknown error'}
          </MessageBox>
        )
        console.error(err)
      })
  }, [account, hideModal, history, inputValueAmount, purchaseCallback, saleId, showModal])
  const handleCancel = useCallback(() => {
    if (!saleId) return
    showModal(<TransacitonPendingModal />)
    cancelSaleCallback(saleId)
      .then(hash => {
        hideModal()
        showModal(<TransactiontionSubmittedModal hash={hash} />)
      })
      .catch((err: any) => {
        hideModal()
        showModal(
          <MessageBox type="error">
            {err?.data?.message || err?.error?.message || err?.message || 'unknown error'}
          </MessageBox>
        )
        console.error(err)
      })
  }, [cancelSaleCallback, hideModal, saleId, showModal])

  const closeTimeLeft = useMemo(() => {
    if (!SwapData || !salesInfo) return
    const now = currentTimeStamp()
    let targetTimeString = ''
    if (SwapData.status === SwapStatus.SOON) {
      targetTimeString = getTargetTimeString(Number(salesInfo?.startTime), now)
    } else if (SwapData.status === SwapStatus.OPEN) {
      targetTimeString = getTargetTimeString(now, Number(salesInfo?.endTime))
    } else if (SwapData.status === SwapStatus.CANCEL) {
      targetTimeString = 'canceled'
    } else {
      targetTimeString = getTargetTimeString(Number(salesInfo?.endTime), now)
    }
    return targetTimeString
  }, [SwapData, salesInfo])

  const saleTokenBalance = useCurrencyBalance(account || undefined, saleToken || undefined)
  const claimableBalance = useMemo(() => {
    if (!swapAmount || !receiveToken) return
    return tryParseAmount(swapAmount, receiveToken || undefined)
  }, [receiveToken, swapAmount])
  const isOneTimePurchase = new BigNumber(Number(salesInfo?.limitMax)).isEqualTo(
    new BigNumber(Number(salesInfo?.limitMin))
  )
  const saledAmount = useMemo(() => {
    if (!saleToken || !salesInfo) return
    return tryParseAmount(salesInfo.soldAmount, saleToken || undefined)
  }, [saleToken, salesInfo])

  const isCreator = useMemo(() => {
    if (!salesInfo || !account) return
    return parseInt(salesInfo?.creator, 16) === parseInt(account, 16)
  }, [account, salesInfo])

  const [approveState, approveCallback] = useApproveCallback(
    inputValueAmount,
    chainId ? PUBLICSALE_ADDRESS[chainId as ChainId] : undefined
  )
  console.log(approveState)

  return (
    <Box
      sx={{
        maxWidth: 1140,
        width: '100%',
        margin: '30px auto 20px',
        textAlign: 'left',
        padding: { xs: '0 16px', sm: undefined }
      }}
    >
      <Back />
      <Stack display={'grid'} gridTemplateColumns="4fr 2fr" gap={10}>
        <Stack className="left_content">
          <Stack
            mb={20}
            mt={20}
            display={'grid'}
            gridTemplateColumns="250px 100px 250px"
            alignItems={'center'}
            textAlign={'center'}
            justifyContent={'flex-start'}
            gap={10}
          >
            <CardWrapper>
              <img src={SwapData?.saleTokenImg} alt="" />
              <div>
                <p>{saleToken?.symbol}</p>
                <div className="iconList">
                  {imgDataList.map((item, inx) => {
                    return <img key={inx} src={item} alt="" />
                  })}
                </div>
              </div>
            </CardWrapper>
            <p>&gt;&gt;</p>
            <CardWrapper>
              <img src={SwapData?.receiveTokenImg} alt="" />
              <div>
                <p>{receiveToken?.symbol}</p>
                <div className="iconList">
                  {imgDataList.map((item, inx) => {
                    return <img key={inx} src={item} alt="" />
                  })}
                </div>
              </div>
            </CardWrapper>
          </Stack>
          <Stack display={'grid'} gridTemplateColumns="1fr 1fr">
            <ColSentence>
              <p>Original price (create at {timeStampToFormat(Number(SwapData?.createTime))})</p>
              <p>
                1 {saleToken?.symbol} = {SwapData?.originalDiscount} {receiveToken?.symbol}
              </p>
            </ColSentence>
            <ColSentence>
              <p>Current price</p>
              <p>
                1 {saleToken?.symbol} ={' '}
                {Number(new BigNumber(0.9).multipliedBy(new BigNumber(SwapData?.originalDiscount)))}{' '}
                {receiveToken?.symbol}
              </p>
            </ColSentence>
          </Stack>
          <Stack display={'grid'} gridTemplateColumns="1fr 1fr">
            <ColSentence>
              <p>Funding target</p>
              <p>
                {totalAmount?.toSignificant(6, { groupSeparator: ',' })} {receiveToken?.symbol}
              </p>
            </ColSentence>
            <ColSentence>
              <p>Sale progress</p>
              <p
                style={{
                  display: 'flex',
                  justifyContent: 'flex-start',
                  alignItems: 'center',
                  flexDirection: 'row'
                }}
              >
                <span>{progress ? progress : 0}%</span>
                <CircularProgress sx={{ marginLeft: 10 }} variant="determinate" value={progress ? progress : 0} />
              </p>
            </ColSentence>
          </Stack>
          <Stack display={'grid'} gridTemplateColumns="1fr 1fr">
            <ColSentence>
              <p>Status</p>
              <p
                style={{
                  color: SwapData?.status === SwapStatus.SOON ? '#00a0ff' : SwapStatus.OPEN ? '#0a9700' : '#000'
                }}
              >
                {SwapData?.status}
              </p>
            </ColSentence>
            <ColSentence>
              <p>Close at</p>
              <p>{closeTimeLeft}</p>
            </ColSentence>
          </Stack>
          <Stack display={'flex'} flexDirection={'row'} mt={30}>
            {tabs.map(({ value, name }) => (
              <Box
                sx={{
                  width: 'fit-content',
                  paddingBottom: 8,
                  marginRight: 180,
                  cursor: 'pointer'
                }}
                key={value}
                className={`tab-item border-tab-item ${curTab === value ? 'active' : ''}`}
                onClick={() => setCurTab(value)}
              >
                {name}
              </Box>
            ))}
          </Stack>
          {curTab === Tabs.ABOUT ? (
            <Stack spacing={10}>
              {ReactHtmlParser(
                filterXSS(SwapData?.about || '', {
                  onIgnoreTagAttr: function(_, name, value) {
                    if (name === 'class') {
                      return name + '="' + escapeAttrValue(value) + '"'
                    }
                    return undefined
                  }
                })
              )}
            </Stack>
          ) : (
            <TransactionList loading={ListLoading} page={listPage} result={listRes} />
          )}
        </Stack>
        <Stack className="right_content">
          {!isOneTimePurchase ? (
            <Stack
              mb={50}
              sx={{
                padding: 16,
                fontSize: 12,
                border: `1px solid ${theme.bgColor.bg2}`,
                boxShadow: `inset 0px -1px 0px ${theme.bgColor.bg2}`
              }}
            >
              <RowSentence>
                <span>Sale type</span>
                <span>Purchase limit</span>
              </RowSentence>
              <RowSentence>
                <span>Price</span>
                <span>
                  1 {saleToken?.symbol} ={' '}
                  {Number(new BigNumber(0.9).multipliedBy(new BigNumber(SwapData?.originalDiscount)))}{' '}
                  {receiveToken?.symbol}
                </span>
              </RowSentence>
              <RowSentence>
                <span>Est.discount</span>
                <span>-10%</span>
              </RowSentence>
              <Input
                readOnly
                value={swapAmount}
                errSet={() => {}}
                onChange={() => {}}
                placeholder=""
                label="Swap"
                endAdornment={`${receiveToken?.symbol}`}
                rightLabel=""
                type="swap"
              />
              <Input
                value={salesAmount}
                errSet={() => {}}
                onChange={e => {
                  if (
                    saleTokenBalance &&
                    new BigNumber(e.target.value).isGreaterThan(new BigNumber(saleTokenBalance?.toSignificant(6)))
                  )
                    return
                  setSalesAmount(e.target.value || '')
                  const ratio = Number(new BigNumber(0.9).multipliedBy(new BigNumber(SwapData?.originalDiscount)))
                  const value = new BigNumber(Number(salesAmount)).multipliedBy(new BigNumber(ratio))
                  setSwapAmount(value.toString() || '')
                }}
                placeholder=""
                label="Pay"
                endAdornment={`${saleToken?.symbol}`}
                rightLabel={`Balance: ${saleTokenBalance?.toSignificant(6, { groupSeparator: ',' })} ${
                  saleToken?.symbol
                }`}
                type="pay"
              />
              <RowSentence>
                <span>Claimable balance:</span>
                <span>
                  {claimableBalance?.toSignificant(6, { groupSeparator: ',' })}
                  {receiveToken?.symbol}
                </span>
              </RowSentence>
              <Typography color={theme.palette.text.secondary} fontWeight={500} lineHeight={1.5} variant="inherit">
                *You should do your own research and understand the risks before committing your funds.
              </Typography>
              <Stack display="grid" gridTemplateRows="1fr 1fr" alignItems={'center'} justifyContent={'center'} pt={30}>
                {SwapData?.status === SwapStatus.ENDED || SwapData?.status === SwapStatus.CANCEL ? (
                  <BlackButton disabled width="252px">
                    Sale ended
                  </BlackButton>
                ) : (
                  <BlackButton
                    width="252px"
                    disabled={new BigNumber(salesAmount).isLessThan(0)}
                    onClick={approveState === ApprovalState.NOT_APPROVED ? approveCallback : handlePay}
                  >
                    {approveState === ApprovalState.PENDING
                      ? 'Approving'
                      : approveState === ApprovalState.NOT_APPROVED
                      ? 'Approve'
                      : 'Pay'}
                  </BlackButton>
                )}
              </Stack>
            </Stack>
          ) : (
            <Stack
              mb={50}
              sx={{
                fontSize: 12,
                padding: 16,
                border: `1px solid ${theme.bgColor.bg2}`,
                boxShadow: `inset 0px -1px 0px ${theme.bgColor.bg2}`
              }}
            >
              <RowSentence>
                <span>Sale type</span>
                <span>One-time purchase</span>
              </RowSentence>
              <RowSentence>
                <span>Price</span>
                <span>
                  1 {saleToken?.symbol} ={' '}
                  {Number(new BigNumber(0.9).multipliedBy(new BigNumber(SwapData?.originalDiscount)))}{' '}
                  {receiveToken?.symbol}
                </span>
              </RowSentence>
              <RowSentence>
                <span>Discount</span>
                <span>-10%</span>
              </RowSentence>
              <RowSentence>
                <span>Saled</span>
                <span>
                  {saledAmount?.toSignificant(6, { groupSeparator: ',' })} {receiveToken?.symbol}
                </span>
              </RowSentence>
              <RowSentence>
                <span></span>
                <Input
                  value={salesAmount}
                  errSet={() => {}}
                  onChange={e => {
                    setSalesAmount(e.target.value || '')
                  }}
                  placeholder=""
                  label="Pay"
                  endAdornment={`${saleToken?.symbol}`}
                  rightLabel={`Balance: ${saleTokenBalance?.toSignificant(6, { groupSeparator: ',' })} ${
                    saleToken?.symbol
                  }`}
                  type="pay"
                />
              </RowSentence>
              <Stack display="grid" gridTemplateRows="1fr 1fr" alignItems={'center'} justifyContent={'center'} pt={30}>
                {SwapData?.status === SwapStatus.ENDED || SwapData?.status === SwapStatus.CANCEL ? (
                  <BlackButton disabled width="252px">
                    Sale ended
                  </BlackButton>
                ) : (
                  <BlackButton
                    width="252px"
                    disabled={new BigNumber(salesAmount).isLessThan(0)}
                    onClick={approveState === ApprovalState.NOT_APPROVED ? approveCallback : handlePay}
                  >
                    {approveState === ApprovalState.PENDING
                      ? 'Approving'
                      : approveState === ApprovalState.NOT_APPROVED
                      ? 'Approve'
                      : 'Pay'}
                  </BlackButton>
                )}
              </Stack>
              <RowSentence>
                <span>Claimable balance:</span>
                <span>
                  {new BigNumber(swapAmount).toFixed(6, BigNumber.ROUND_HALF_DOWN).toString()} {receiveToken?.symbol}
                </span>
              </RowSentence>
            </Stack>
          )}
          {isCreator ? (
            <Stack
              sx={{
                fontSize: 12,
                padding: 16,
                border: `1px solid ${theme.bgColor.bg2}`,
                boxShadow: `inset 0px -1px 0px ${theme.bgColor.bg2}`
              }}
            >
              <RowSentence>
                <span>Balance</span>
                <span>1,000 RAI</span>
              </RowSentence>
              <Stack display="grid" gridTemplateRows="1fr 1fr" alignItems={'center'} justifyContent={'center'} pt={30}>
                <BlackButton width="252px" onClick={handleCancel}>
                  Cancel event
                </BlackButton>
              </Stack>
            </Stack>
          ) : (
            ''
          )}
        </Stack>
      </Stack>
    </Box>
  )
}
