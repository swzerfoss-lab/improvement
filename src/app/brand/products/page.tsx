import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { btn, Card, input, label, money, PageHeader, TierBadge } from "@/components/ui";
import { db } from "@/db";
import { products } from "@/db/schema";
import { minTierForValue, TIER_IDS, TIERS } from "@/engine/tiers";
import { requireBrand } from "@/lib/brand";
import { createProduct } from "../actions";

const SIZE_TYPE_LABELS = {
  apparel: "Clothing (XS to XXL)",
  shoe: "Shoes (US sizes)",
  one_size: "One size",
};

export default async function ProductsPage() {
  const { brand } = await requireBrand();
  const list = await db
    .select()
    .from(products)
    .where(eq(products.brandId, brand.id))
    .orderBy(desc(products.createdAt));

  return (
    <>
      <PageHeader
        title="Products"
        subtitle="The gear you want to reward people with. Each campaign offers one product."
      />
      <div className="grid gap-6 md:grid-cols-5">
        <div className="space-y-4 md:col-span-3">
          {list.length === 0 && (
            <p className="text-sm text-zinc-600">No products yet. Add one to start a campaign.</p>
          )}
          {list.map((product) => (
            <Card key={product.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{product.name}</h2>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-600">
                    Retail {money(product.retailValueCents)} · costs you{" "}
                    {money(product.unitCostCents)} a reward
                    <TierBadge tier={minTierForValue(product.retailValueCents)} />
                  </p>
                </div>
                <Link href={`/brand/campaigns/new?product=${product.id}`} className={btn("primary")}>
                  Create campaign
                </Link>
              </div>
            </Card>
          ))}
        </div>

        <Card className="h-fit md:col-span-2">
          <h2 className="font-semibold">Add a product</h2>
          <ActionForm action={createProduct} className="mt-4 space-y-4">
            <div>
              <label className={label} htmlFor="name">Name</label>
              <input className={input} id="name" name="name" required />
            </div>
            <div>
              <label className={label} htmlFor="description">Description (optional)</label>
              <textarea className={input} id="description" name="description" rows={3} />
            </div>
            <div>
              <label className={label} htmlFor="sizeType">Sizing</label>
              <select className={input} id="sizeType" name="sizeType">
                {Object.entries(SIZE_TYPE_LABELS).map(([value, text]) => (
                  <option key={value} value={value}>{text}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label} htmlFor="retailValue">Retail value ($)</label>
                <input className={input} id="retailValue" name="retailValue" type="number" min="1" step="0.01" required />
              </div>
              <div>
                <label className={label} htmlFor="unitCost">Your cost per reward ($)</label>
                <input className={input} id="unitCost" name="unitCost" type="number" min="0.01" step="0.01" required />
              </div>
            </div>
            <p className="text-xs text-zinc-500">
              Your cost should include shipping: rewards are free to members.
              Retail value sets the easiest tier allowed:{" "}
              {TIER_IDS.map((id) => {
                const max = TIERS[id].maxRetailCents;
                return `${TIERS[id].name} ${max === null ? "above that" : `up to ${money(max)}`}`;
              }).join(", ")}
              .
            </p>
            <SubmitButton>Add product and set up a campaign</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
