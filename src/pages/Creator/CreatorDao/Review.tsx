import { Box } from '@mui/material'
import { routes } from 'constants/routes'
import Pending from '../../../components/Pending'

export default function Review({ hash }: { hash: string | undefined }) {
  return (
    <Box mt={60} display="flex" justifyContent={'center'}>
      <Pending doneLink={routes.Governance} doneText="Back to governance list" hash={hash} />
    </Box>
  )
}
