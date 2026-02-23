import { updateOrganization } from '../src/app/actions/updateOrganization';

async function main() {
  const result = await updateOrganization({
    id: "d3c6f063-ea43-42a7-a02d-2daa55912a43",
    tenantId: "00000000-0000-0000-0000-000000000003",
    customFields: { status: "ACTIVE" }
  });
  console.log(result);
}
main();
