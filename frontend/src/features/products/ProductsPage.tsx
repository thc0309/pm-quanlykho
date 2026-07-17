import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { Pagination, paginate } from "../../components/common/Pagination";
import { PencilIcon, PlusIcon } from "../../icons";
import {
  catalogApi,
  productApi,
  type CatalogCategory,
  type CatalogUnit,
  type CategorySpecDefinition,
  type Product,
  type ProductClient,
  type ProductCreateInput,
  type ProductSpecValue,
  type ProductSpecValueInput,
  type ProductUpdateInput,
} from "../../lib/api";
import { hasPermission } from "../../lib/permissions";

const trackingLabels: Record<Product["trackingMode"], string> = {
  none: "Không tracking",
  lot: "Theo lô",
  serial: "Theo serial",
};

const panelClass =
  "rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]";
const labelClass = "text-sm font-medium text-gray-700 dark:text-gray-400";
const inputClass =
  "mt-1 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 outline-none focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-100 disabled:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:disabled:bg-gray-800";
const primaryButtonClass =
  "inline-flex h-11 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700 focus-visible:ring-3 focus-visible:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonClass =
  "inline-flex h-11 items-center gap-2 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-3 focus-visible:ring-brand-500/20 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5";
const iconButtonClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 focus-visible:ring-3 focus-visible:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-45 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5";
const tableHeadClass =
  "bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:bg-white/[0.03] dark:text-gray-400";
const tableCellClass = "px-4 py-3 text-sm text-gray-700 dark:text-gray-300";
const rowActionClass =
  "inline-flex h-9 items-center justify-center rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-3 focus-visible:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-45 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5";

type ProductFormState = {
  sku: string;
  name: string;
  productType: Product["productType"];
  trackingMode: Product["trackingMode"];
  expiryManaged: boolean;
  fefoEnabled: boolean;
  categoryId: string;
  baseUnitId: string;
  barcodes: string;
};

type SpecDraftValue = {
  textValue?: string;
  numberValue?: string;
  booleanValue?: boolean;
  optionValue?: string;
};

const emptyForm: ProductFormState = {
  sku: "",
  name: "",
  productType: "stock",
  trackingMode: "none",
  expiryManaged: false,
  fefoEnabled: false,
  categoryId: "",
  baseUnitId: "",
  barcodes: "",
};

function parseBarcodes(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function formFor(product?: Product | null): ProductFormState {
  if (!product) return emptyForm;
  return {
    sku: product.sku,
    name: product.name,
    productType: product.productType,
    trackingMode: product.trackingMode,
    expiryManaged: product.expiryManaged,
    fefoEnabled: product.fefoEnabled,
    categoryId: product.categoryId ?? "",
    baseUnitId: product.baseUnitId ?? "",
    barcodes: product.barcodes.join(", "),
  };
}

function specDraftFromValues(values: ProductSpecValue[]) {
  return values.reduce<Record<string, SpecDraftValue>>((result, value) => {
    if (value.type === "text") result[value.definitionId] = { textValue: String(value.value) };
    if (value.type === "number") result[value.definitionId] = { numberValue: String(value.value) };
    if (value.type === "boolean") result[value.definitionId] = { booleanValue: Boolean(value.value) };
    if (value.type === "select") result[value.definitionId] = { optionValue: String(value.value) };
    return result;
  }, {});
}

function hasSpecDraftValue(value?: SpecDraftValue) {
  if (!value) return false;
  return Boolean(
    value.textValue?.trim()
    || value.numberValue?.trim()
    || value.optionValue?.trim()
    || value.booleanValue !== undefined,
  );
}

function buildSpecValues(definitions: CategorySpecDefinition[], draftValues: Record<string, SpecDraftValue>) {
  const inputs: ProductSpecValueInput[] = [];
  for (const definition of definitions) {
    const value = draftValues[definition.id];
    if (!hasSpecDraftValue(value)) continue;
    if (definition.type === "text" && value?.textValue?.trim()) {
      inputs.push({ definitionId: definition.id, textValue: value.textValue.trim() });
    }
    if (definition.type === "number" && value?.numberValue?.trim()) {
      inputs.push({ definitionId: definition.id, numberValue: Number(value.numberValue) });
    }
    if (definition.type === "boolean" && value?.booleanValue !== undefined) {
      inputs.push({ definitionId: definition.id, booleanValue: value.booleanValue });
    }
    if (definition.type === "select" && value?.optionValue?.trim()) {
      inputs.push({ definitionId: definition.id, optionValue: value.optionValue.trim() });
    }
  }
  return inputs;
}

function validateSpecValues(definitions: CategorySpecDefinition[], draftValues: Record<string, SpecDraftValue>) {
  for (const definition of definitions) {
    const value = draftValues[definition.id];
    if (definition.required && !hasSpecDraftValue(value)) {
      return `Vui lòng nhập thông số bắt buộc: ${definition.name}.`;
    }
  }
  return "";
}

function formatSpecValue(value: ProductSpecValue) {
  if (value.type === "boolean") return `${value.name}: ${value.value ? "Có" : "Không"}`;
  if (value.type === "select") return `${value.name}: ${value.optionLabel ?? value.value}`;
  return `${value.name}: ${value.value}${value.unit ? ` ${value.unit}` : ""}`;
}

function productSpecSummary(product: Product) {
  const specValues = product.specValues ?? [];
  if (specValues.length === 0) return "Chưa có thông số";
  return specValues.slice(0, 2).map(formatSpecValue).join(" • ");
}

export default function ProductsPage({ api = productApi, permissions = ["*"] }: { api?: ProductClient; permissions?: readonly string[] }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [barcode, setBarcode] = useState("");
  const [lookupResult, setLookupResult] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const canCreate = hasPermission(permissions, "products.create");
  const canUpdate = hasPermission(permissions, "products.update");
  const canChangeStatus = hasPermission(permissions, "products.delete");

  useEffect(() => {
    api.listProducts()
      .then(setProducts)
      .catch(() => setError("Không thể tải sản phẩm. Hãy thử tải lại trang."))
      .finally(() => setLoading(false));
  }, [api]);

  async function lookup(event: FormEvent) {
    event.preventDefault();
    setLookupResult("");
    setError("");
    try {
      const product = await api.findProductByBarcode(barcode);
      setLookupResult(`Tìm thấy: ${product.sku} - ${product.name}`);
    } catch {
      setError("Không tìm thấy barcode trong kho.");
    }
  }

  async function changeStatus(product: Product) {
    const nextStatus = product.status === "active" ? "inactive" : "active";
    const action = nextStatus === "inactive" ? "vô hiệu hóa" : "kích hoạt";
    if (!window.confirm(`Bạn có chắc muốn ${action} sản phẩm ${product.name}?`)) return;
    setBusyId(product.id);
    setError("");
    try {
      const updated = await api.setProductStatus(product.id, nextStatus);
      setProducts((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (caught) {
      setError(errorMessage(caught, `Không thể ${action} sản phẩm`));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p role="status" className="text-sm text-gray-500 dark:text-gray-400">Đang tải sản phẩm…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 text-pretty dark:text-white/90">Sản phẩm</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Quản lý SKU, barcode, danh mục và thông số sản phẩm.</p>
        </div>
        {canCreate && (
          <Link to="/products/create" className={primaryButtonClass}>
            <PlusIcon className="h-4 w-4" />
            Thêm sản phẩm
          </Link>
        )}
      </div>

      <form onSubmit={lookup} className={`flex flex-col gap-3 sm:flex-row sm:items-end ${panelClass}`}>
        <label className={`${labelClass} flex-1`}>
          Tra barcode
          <input value={barcode} onChange={(event) => setBarcode(event.target.value)} className={inputClass} />
        </label>
        <button type="submit" className={secondaryButtonClass}>Tra</button>
      </form>

      {error && <p role="alert" className="rounded-lg bg-error-50 p-3 text-sm text-error-700 dark:bg-error-500/15 dark:text-error-400">{error}</p>}
      {lookupResult && <p role="status" className="rounded-lg bg-success-50 p-3 text-sm text-success-700 dark:bg-success-500/15 dark:text-success-400">{lookupResult}</p>}

      <section className={panelClass}>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">Danh sách sản phẩm</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800">
            <thead className={tableHeadClass}>
              <tr>
                <th className="px-4 py-3">Tên sản phẩm</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Barcode</th>
                <th className="px-4 py-3">Tracking</th>
                <th className="px-4 py-3">Thông số</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {products.length === 0 ? (
                <tr><td colSpan={7} className={`${tableCellClass} text-center text-gray-500 dark:text-gray-400`}>Chưa có sản phẩm.</td></tr>
              ) : paginate(products, page).map((product) => (
                <tr key={product.id}>
                  <td className={`${tableCellClass} min-w-56 font-medium text-gray-800 dark:text-white/90`}>{product.name}</td>
                  <td className={tableCellClass}>{product.sku}</td>
                  <td className={tableCellClass}>{product.barcodes.join(", ")}</td>
                  <td className={tableCellClass}>{trackingLabels[product.trackingMode]}</td>
                  <td className={`${tableCellClass} min-w-72`}>{productSpecSummary(product)}</td>
                  <td className={tableCellClass}>{product.status === "active" ? "Đang dùng" : "Tạm ngưng"}</td>
                  <td className={`${tableCellClass} text-right`}>
                    <div className="inline-flex items-center gap-2">
                      {canUpdate && (
                        <Link to={`/products/${product.id}/edit`} aria-label={`Sửa sản phẩm ${product.name}`} title="Sửa sản phẩm" className={iconButtonClass}>
                          <PencilIcon className="h-4 w-4" />
                        </Link>
                      )}
                      {canChangeStatus && (
                        <button type="button" disabled={busyId === product.id} aria-label={`${product.status === "active" ? "Vô hiệu hóa" : "Kích hoạt"} sản phẩm ${product.name}`} className={rowActionClass} onClick={() => changeStatus(product)}>
                          {busyId === product.id ? "Đang xử lý…" : product.status === "active" ? "Vô hiệu hóa" : "Kích hoạt"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalItems={products.length} onPageChange={setPage} />
      </section>
    </div>
  );
}

export function ProductCreatePage({
  api = productApi,
  catalog = catalogApi,
}: {
  api?: ProductClient;
  catalog?: Pick<typeof catalogApi, "listCategories" | "listUnits" | "listCategorySpecDefinitions">;
}) {
  const navigate = useNavigate();
  const { productId } = useParams();
  const isEditMode = Boolean(productId);
  const [form, setForm] = useState<ProductFormState>(emptyForm);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [units, setUnits] = useState<CatalogUnit[]>([]);
  const [definitions, setDefinitions] = useState<CategorySpecDefinition[]>([]);
  const [inactiveSpecValues, setInactiveSpecValues] = useState<ProductSpecValue[]>([]);
  const [specDraftValues, setSpecDraftValues] = useState<Record<string, SpecDraftValue>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadDefinitions(categoryId: string, existingValues: Record<string, SpecDraftValue> = {}) {
    if (!categoryId) {
      setDefinitions([]);
      setSpecDraftValues({});
      return;
    }
      const nextDefinitions = await catalog.listCategorySpecDefinitions(categoryId);
    setDefinitions(nextDefinitions);
    setSpecDraftValues((current) => {
      const source = Object.keys(existingValues).length > 0 ? existingValues : current;
      return nextDefinitions.reduce<Record<string, SpecDraftValue>>((result, definition) => {
        if (source[definition.id]) result[definition.id] = source[definition.id]!;
        else if (definition.type === "boolean") result[definition.id] = {};
        return result;
      }, {});
    });
  }

  useEffect(() => {
    let active = true;
    async function bootstrap() {
      try {
        const [nextCategories, nextUnits, product] = await Promise.all([
          catalog.listCategories(),
          catalog.listUnits(),
          isEditMode && productId ? api.getProduct(productId) : Promise.resolve(null),
        ]);
        if (!active) return;
        setCategories(nextCategories);
        setUnits(nextUnits);
        if (product) {
          setForm(formFor(product));
          const draft = specDraftFromValues(product.specValues);
          const activeDefinitions = product.categoryId ? await catalog.listCategorySpecDefinitions(product.categoryId) : [];
          if (!active) return;
          setDefinitions(activeDefinitions);
          setSpecDraftValues(activeDefinitions.reduce<Record<string, SpecDraftValue>>((result, definition) => {
            if (draft[definition.id]) result[definition.id] = draft[definition.id]!;
            else if (definition.type === "boolean") result[definition.id] = {};
            return result;
          }, {}));
          setInactiveSpecValues(product.specValues.filter((value) => !activeDefinitions.some((definition) => definition.id === value.definitionId)));
        }
      } catch (caught) {
        if (!active) return;
        setError(errorMessage(caught, isEditMode ? "Không tìm thấy sản phẩm cần sửa." : "Không thể tải dữ liệu sản phẩm."));
      } finally {
        if (active) setLoading(false);
      }
    }
    bootstrap();
    return () => {
      active = false;
    };
  }, [api, catalog, isEditMode, productId]);

  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories]);
  const unitById = useMemo(() => new Map(units.map((unit) => [unit.id, unit.name])), [units]);

  async function handleCategoryChange(nextCategoryId: string) {
    const hasValues = Object.values(specDraftValues).some(hasSpecDraftValue);
    if (form.categoryId && form.categoryId !== nextCategoryId && hasValues && !window.confirm("Đổi danh mục sẽ làm mới phần thông số hiện tại. Bạn có muốn tiếp tục?")) {
      return;
    }
    setForm((current) => ({ ...current, categoryId: nextCategoryId }));
    setInactiveSpecValues([]);
    try {
      await loadDefinitions(nextCategoryId);
    } catch (caught) {
      setError(errorMessage(caught, "Không thể tải thông số của danh mục."));
    }
  }

  async function saveProduct(event: FormEvent) {
    event.preventDefault();
    const specError = validateSpecValues(definitions, specDraftValues);
    if (specError) {
      setError(specError);
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    const specValues = buildSpecValues(definitions, specDraftValues);
    try {
      if (isEditMode && productId) {
        const input: ProductUpdateInput = {
          name: form.name.trim(),
          categoryId: form.categoryId || null,
          baseUnitId: form.baseUnitId || null,
          barcodes: parseBarcodes(form.barcodes),
          specValues,
        };
        if (form.trackingMode === "lot") {
          input.expiryManaged = form.expiryManaged;
          input.fefoEnabled = form.fefoEnabled;
        }
        await api.updateProduct(productId, input);
        navigate("/products");
      } else {
        const input: ProductCreateInput = {
          sku: form.sku.trim(),
          name: form.name.trim(),
          productType: form.productType,
          trackingMode: form.trackingMode,
          expiryManaged: form.expiryManaged,
          fefoEnabled: form.fefoEnabled,
          categoryId: form.categoryId || null,
          baseUnitId: form.baseUnitId || null,
          barcodes: parseBarcodes(form.barcodes),
          specValues,
        };
        await api.createProduct(input);
        setNotice("Đã tạo sản phẩm");
        setForm(emptyForm);
        setDefinitions([]);
        setSpecDraftValues({});
        setInactiveSpecValues([]);
      }
    } catch (caught) {
      setError(errorMessage(caught, isEditMode ? "Không thể cập nhật sản phẩm." : "Không thể tạo sản phẩm. Kiểm tra SKU, barcode hoặc chính sách tracking."));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p role="status" className="text-sm text-gray-500 dark:text-gray-400">Đang tải form sản phẩm…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 text-pretty dark:text-white/90">{isEditMode ? "Sửa sản phẩm" : "Thêm sản phẩm"}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{isEditMode ? "Cập nhật thông tin, barcode và thông số của sản phẩm." : "Nhập SKU, barcode, danh mục và thông số sản phẩm."}</p>
        </div>
        <Link to="/products" className={secondaryButtonClass}>Quay lại</Link>
      </div>

      {error && <p role="alert" className="rounded-lg bg-error-50 p-3 text-sm text-error-700 dark:bg-error-500/15 dark:text-error-400">{error}</p>}
      {notice && <p role="status" className="rounded-lg bg-success-50 p-3 text-sm text-success-700 dark:bg-success-500/15 dark:text-success-400">{notice}</p>}

      <form onSubmit={saveProduct} className={`space-y-6 ${panelClass}`}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className={labelClass}>SKU (*)<input required disabled={isEditMode} autoComplete="off" value={form.sku} onChange={(event) => setForm((current) => ({ ...current, sku: event.target.value }))} className={inputClass} /></label>
          <label className={labelClass}>Tên sản phẩm (*)<input required autoComplete="off" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className={inputClass} /></label>
          <label className={labelClass}>Barcode (*)<input required autoComplete="off" value={form.barcodes} onChange={(event) => setForm((current) => ({ ...current, barcodes: event.target.value }))} className={inputClass} /></label>
          <label className={labelClass}>Loại sản phẩm<select disabled={isEditMode} value={form.productType} onChange={(event) => setForm((current) => ({ ...current, productType: event.target.value as Product["productType"] }))} className={inputClass}><option value="stock">Hàng tồn kho</option><option value="non_stock">Không tồn kho</option><option value="service">Dịch vụ</option></select></label>
          <label className={labelClass}>Tracking<select disabled={isEditMode} value={form.trackingMode} onChange={(event) => setForm((current) => ({ ...current, trackingMode: event.target.value as Product["trackingMode"] }))} className={inputClass}><option value="none">Không tracking</option><option value="lot">Theo lô</option><option value="serial">Theo serial</option></select></label>
          <label className={labelClass}>Danh mục<select value={form.categoryId} onChange={(event) => void handleCategoryChange(event.target.value)} className={inputClass}><option value="">Chưa chọn danh mục</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <label className={labelClass}>Đơn vị gốc<select value={form.baseUnitId} onChange={(event) => setForm((current) => ({ ...current, baseUnitId: event.target.value }))} className={inputClass}><option value="">Chưa chọn đơn vị</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label>
          <div className="sm:col-span-2 lg:col-span-2 flex flex-wrap items-center gap-5 pt-8 text-sm font-medium text-gray-700 dark:text-gray-300">
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.expiryManaged} disabled={form.trackingMode !== "lot"} onChange={(event) => setForm((current) => ({ ...current, expiryManaged: event.target.checked }))} /> Quản lý hạn dùng</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.fefoEnabled} disabled={form.trackingMode !== "lot"} onChange={(event) => setForm((current) => ({ ...current, fefoEnabled: event.target.checked }))} /> FEFO</label>
          </div>
        </div>

        <section className="space-y-4 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">Thông số</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {form.categoryId ? `Danh mục hiện tại: ${categoryById.get(form.categoryId) ?? "Đang chọn"}` : "Chọn danh mục để nhập thông số tương ứng."}
            </p>
          </div>
          {definitions.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{form.categoryId ? "Danh mục này chưa có thông số." : "Chưa có danh mục để hiển thị thông số."}</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {definitions.map((definition) => {
                const draft = specDraftValues[definition.id] ?? {};
                return (
                  <div key={definition.id} className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                    <label className={labelClass}>
                      {definition.name}{definition.required ? " (*)" : ""}
                      {definition.type === "text" && (
                        <input value={draft.textValue ?? ""} onChange={(event) => setSpecDraftValues((current) => ({ ...current, [definition.id]: { ...current[definition.id], textValue: event.target.value } }))} className={inputClass} />
                      )}
                      {definition.type === "number" && (
                        <input type="number" value={draft.numberValue ?? ""} onChange={(event) => setSpecDraftValues((current) => ({ ...current, [definition.id]: { ...current[definition.id], numberValue: event.target.value } }))} className={inputClass} />
                      )}
                      {definition.type === "select" && (
                        <select value={draft.optionValue ?? ""} onChange={(event) => setSpecDraftValues((current) => ({ ...current, [definition.id]: { ...current[definition.id], optionValue: event.target.value } }))} className={inputClass}>
                          <option value="">Chọn giá trị</option>
                          {definition.options.filter((option) => option.status === "active").map((option) => <option key={option.id} value={option.value}>{option.label}</option>)}
                        </select>
                      )}
                    </label>
                    {definition.type === "boolean" && (
                      <div className="mt-4 flex items-center gap-4 text-sm text-gray-700 dark:text-gray-300">
                        <label className="flex items-center gap-2"><input type="radio" name={`spec-${definition.id}`} checked={draft.booleanValue === true} onChange={() => setSpecDraftValues((current) => ({ ...current, [definition.id]: { ...current[definition.id], booleanValue: true } }))} /> Có</label>
                        <label className="flex items-center gap-2"><input type="radio" name={`spec-${definition.id}`} checked={draft.booleanValue === false} onChange={() => setSpecDraftValues((current) => ({ ...current, [definition.id]: { ...current[definition.id], booleanValue: false } }))} /> Không</label>
                      </div>
                    )}
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      {definition.type === "number" && (definition.unit || definition.minValue || definition.maxValue)
                        ? [definition.unit ? `Đơn vị: ${definition.unit}` : null, definition.minValue ? `Min: ${definition.minValue}` : null, definition.maxValue ? `Max: ${definition.maxValue}` : null].filter(Boolean).join(" • ")
                        : " "}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
          {inactiveSpecValues.length > 0 && (
            <div className="space-y-2 rounded-xl border border-warning-300 bg-warning-50 p-4 text-sm text-warning-800 dark:border-warning-700 dark:bg-warning-500/10 dark:text-warning-300">
              <h3 className="font-semibold">Thông số cũ đang ngưng áp dụng</h3>
              {inactiveSpecValues.map((value) => <p key={value.definitionId}>{formatSpecValue(value)}</p>)}
            </div>
          )}
        </section>

        <div className="rounded-xl border border-gray-200 p-4 text-sm text-gray-600 dark:border-gray-800 dark:text-gray-300">
          {form.categoryId && form.baseUnitId
            ? `Danh mục: ${categoryById.get(form.categoryId) ?? "Không xác định"} • Đơn vị: ${unitById.get(form.baseUnitId) ?? "Không xác định"}`
            : "Nên chọn đầy đủ danh mục và đơn vị để sản phẩm có cấu hình rõ ràng."}
        </div>

        <button type="submit" disabled={busy} className={primaryButtonClass}>{isEditMode ? "Lưu thay đổi" : "Tạo sản phẩm"}</button>
      </form>
    </div>
  );
}
