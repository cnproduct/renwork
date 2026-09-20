import {
  OrganizationInviteEmail,
  type OrganizationInviteEmailProps,
} from "../src/templates/organization-invite"

export default function OrganizationInvitePreview(props: OrganizationInviteEmailProps) {
  return <OrganizationInviteEmail {...props} />
}

OrganizationInvitePreview.PreviewProps = {
  inviteLink: "https://www.rrenn.com/join-org?invite=invitation_preview",
  invitedByName: "Ada Lovelace",
  invitedByEmail: "ada@example.com",
  organizationName: "RenWork Preview",
  role: "admin",
} satisfies OrganizationInviteEmailProps
