import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { Pagination, paginate } from "../../components/common/Pagination";
import { PencilIcon, PlusIcon } from "../../icons";
import {
  catalogApi,
  type CatalogCategory,
  type CatalogClient,
  type CatalogUnit,
  type CategorySpecDefinition,
  type CategorySpecOption,
  type CategorySpecType,
} from "../../lib/api";
import { hasPermission } from "../../lib/permissions";

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

type CatalogListProps = { api?: CatalogClient; permissions?: readonly string[] };

type CategoryFormState = { code: string; name: string };
type UnitFormState = { code: string; name: string; mode: "base" | "conversion"; baseUnitId: string; conversionFactor: string };
type SpecDefinitionFormState = {
  code: string;
  name: string;
  type: CategorySpecType;
  required: boolean;
  unit: string;
  minValue: string;
  maxValue: string;
  sortOrder: string;
  options: Array<{ value: string; label: string; sortOrder: string }>;
};
type SpecDefinitionUpdateFormState = {
  name: string;
  required: boolean;
  unit: string;
  minValue: string;
  maxValue: string;
  sortOrder: string;
};
type SpecOptionFormState = { value: string; label: string; sortOrder: string };
type SpecOptionUpdateFormState = { label: string; sortOrder: string };

const emptyCategoryForm: CategoryFormState = { code: "", name: "" };
const emptyUnitForm: UnitFormState = { code: "", name: "", mode: "base", baseUnitId: "", conversionFactor: "" };
const emptySpecDefinitionForm: SpecDefinitionFormState = {
  code: "",
  name: "",
  type: "text",
  required: false,
  unit: "",
  minValue: "",
  maxValue: "",
  sortOrder: "0",
  options: [{ value: "", label: "", sortOrder: "0" }],
};
const emptySpecOptionForm: SpecOptionFormState = { value: "", label: "", sortOrder: "0" };

const specTypeLabels: Record<CategorySpecType, string> = {
  text: "Chuỗi",
  number: "Số",
  boolean: "Đúng/Sai",
  select: "Danh sách chọn",
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function categoryFormFor(category?: CatalogCategory | null): CategoryFormState {
  if (!category) return emptyCategoryForm;
  return { code: category.code, name: category.name };
}

function unitFormFor(unit?: CatalogUnit | null): UnitFormState {
  if (!unit) return emptyUnitForm;
  return {
    code: unit.code,
    name: unit.name,
    mode: unit.baseUnitId ? "conversion" : "base",
    baseUnitId: unit.baseUnitId ?? "",
    conversionFactor: unit.conversionFactor,
  };
}

function definitionUpdateFormFor(definition: CategorySpecDefinition): SpecDefinitionUpdateFormState {
  return {
    name: definition.name,
    required: definition.required,
    unit: definition.unit ?? "",
    minValue: definition.minValue ?? "",
    maxValue: definition.maxValue ?? "",
    sortOrder: String(definition.sortOrder),
  };
}

function optionUpdateFormFor(option: CategorySpecOption): SpecOptionUpdateFormState {
  return { label: option.label, sortOrder: String(option.sortOrder) };
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) return undefined;
  return Number(value);
}

function parseOptionalNullableNumber(value: string) {
  if (!value.trim()) return null;
  return Number(value);
}

function normalizeSpecDefinitionForm(form: SpecDefinitionFormState) {
  return {
    code: form.code.trim(),
    name: form.name.trim(),
    type: form.type,
    required: form.required,
    unit: form.type === "number" ? form.unit.trim() || undefined : undefined,
    minValue: form.type === "number" ? parseOptionalNumber(form.minValue) : undefined,
    maxValue: form.type === "number" ? parseOptionalNumber(form.maxValue) : undefined,
    sortOrder: Number(form.sortOrder || "0"),
    options: form.type === "select"
      ? form.options
        .map((option) => ({
          value: option.value.trim(),
          label: option.label.trim(),
          sortOrder: Number(option.sortOrder || "0"),
        }))
        .filter((option) => option.value || option.label)
      : [],
  };
}

function normalizeSpecDefinitionUpdateForm(form: SpecDefinitionUpdateFormState) {
  return {
    name: form.name.trim(),
    required: form.required,
    unit: form.unit.trim() || null,
    minValue: parseOptionalNullableNumber(form.minValue),
    maxValue: parseOptionalNullableNumber(form.maxValue),
    sortOrder: Number(form.sortOrder || "0"),
  };
}

export function CategoriesPage({ api = catalogApi, permissions = ["*"] }: CatalogListProps) {
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const canCreate = hasPermission(permissions, "catalog.categories.create");
  const canUpdate = hasPermission(permissions, "catalog.categories.update");
  const canChangeStatus = hasPermission(permissions, "catalog.categories.delete");
  const canViewSpecs = hasPermission(permissions, "catalog.specs.view");

  useEffect(() => {
    api.listCategories()
      .then(setCategories)
      .catch(() => setError("Không thể tải danh mục. Hãy thử tải lại trang."))
      .finally(() => setLoading(false));
  }, [api]);

  async function changeCategoryStatus(category: CatalogCategory) {
    const nextStatus = category.status === "active" ? "inactive" : "active";
    const action = nextStatus === "inactive" ? "vô hiệu hóa" : "kích hoạt";
    if (!window.confirm(`Bạn có chắc muốn ${action} danh mục ${category.name}?`)) return;
    setBusyId(category.id);
    setError("");
    try {
      const updated = await api.setCategoryStatus(category.id, nextStatus);
      setCategories((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (caught) {
      setError(errorMessage(caught, `Không thể ${action} danh mục`));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p role="status" className="text-sm text-gray-500 dark:text-gray-400">Đang tải danh mục…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 text-pretty dark:text-white/90">Danh mục</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Quản lý nhóm hàng theo kho.</p>
        </div>
        {canCreate && (
          <Link to="/catalog/categories/create" className={primaryButtonClass}>
            <PlusIcon className="h-4 w-4" />
            Thêm danh mục
          </Link>
        )}
      </div>

      {error && <p role="alert" className="rounded-lg bg-error-50 p-3 text-sm text-error-700 dark:bg-error-500/15 dark:text-error-400">{error}</p>}

      <section className={panelClass}>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">Danh sách danh mục</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800">
            <thead className={tableHeadClass}>
              <tr>
                <th scope="col" className="px-4 py-3">Tên danh mục</th>
                <th scope="col" className="px-4 py-3">Mã</th>
                <th scope="col" className="px-4 py-3">Trạng thái</th>
                <th scope="col" className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {categories.length === 0 ? (
                <tr>
                  <td colSpan={4} className={`${tableCellClass} text-center text-gray-500 dark:text-gray-400`}>Chưa có danh mục.</td>
                </tr>
              ) : paginate(categories, page).map((category) => (
                <tr key={category.id}>
                  <td className={`${tableCellClass} font-medium text-gray-800 dark:text-white/90`}>{category.name}</td>
                  <td className={tableCellClass}>{category.code}</td>
                  <td className={tableCellClass}>{category.status === "active" ? "Đang dùng" : "Tạm ngưng"}</td>
                  <td className={`${tableCellClass} text-right`}>
                    <div className="inline-flex items-center gap-2">
                      {canViewSpecs && (
                        <Link to={`/catalog/categories/${category.id}/specs`} className={rowActionClass}>
                          Thông số
                        </Link>
                      )}
                      {canUpdate && (
                        <Link to={`/catalog/categories/${category.id}/edit`} aria-label={`Sửa danh mục ${category.name}`} title="Sửa danh mục" className={iconButtonClass}>
                          <PencilIcon className="h-4 w-4" />
                        </Link>
                      )}
                      {canChangeStatus && (
                        <button type="button" disabled={busyId === category.id} aria-label={`${category.status === "active" ? "Vô hiệu hóa" : "Kích hoạt"} danh mục ${category.name}`} className={rowActionClass} onClick={() => changeCategoryStatus(category)}>
                          {busyId === category.id ? "Đang xử lý…" : category.status === "active" ? "Vô hiệu hóa" : "Kích hoạt"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalItems={categories.length} onPageChange={setPage} />
      </section>
    </div>
  );
}

export function UnitsPage({ api = catalogApi, permissions = ["*"] }: CatalogListProps) {
  const [units, setUnits] = useState<CatalogUnit[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const unitNameById = useMemo(() => new Map(units.map((unit) => [unit.id, unit.name])), [units]);
  const canCreate = hasPermission(permissions, "catalog.units.create");
  const canUpdate = hasPermission(permissions, "catalog.units.update");
  const canChangeStatus = hasPermission(permissions, "catalog.units.delete");

  useEffect(() => {
    api.listUnits()
      .then(setUnits)
      .catch(() => setError("Không thể tải đơn vị. Hãy thử tải lại trang."))
      .finally(() => setLoading(false));
  }, [api]);

  async function changeUnitStatus(unit: CatalogUnit) {
    const nextStatus = unit.status === "active" ? "inactive" : "active";
    const action = nextStatus === "inactive" ? "vô hiệu hóa" : "kích hoạt";
    if (!window.confirm(`Bạn có chắc muốn ${action} đơn vị ${unit.name}?`)) return;
    setBusyId(unit.id);
    setError("");
    try {
      const updated = await api.setUnitStatus(unit.id, nextStatus);
      setUnits((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (caught) {
      setError(errorMessage(caught, `Không thể ${action} đơn vị`));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p role="status" className="text-sm text-gray-500 dark:text-gray-400">Đang tải đơn vị…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 text-pretty dark:text-white/90">Đơn vị</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Quản lý đơn vị gốc và đơn vị quy đổi.</p>
        </div>
        {canCreate && (
          <Link to="/catalog/units/create" className={primaryButtonClass}>
            <PlusIcon className="h-4 w-4" />
            Thêm đơn vị
          </Link>
        )}
      </div>

      {error && <p role="alert" className="rounded-lg bg-error-50 p-3 text-sm text-error-700 dark:bg-error-500/15 dark:text-error-400">{error}</p>}

      <section className={panelClass}>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">Danh sách đơn vị</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800">
            <thead className={tableHeadClass}>
              <tr>
                <th scope="col" className="px-4 py-3">Tên đơn vị</th>
                <th scope="col" className="px-4 py-3">Mã</th>
                <th scope="col" className="px-4 py-3">Quy đổi</th>
                <th scope="col" className="px-4 py-3">Trạng thái</th>
                <th scope="col" className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {units.length === 0 ? (
                <tr>
                  <td colSpan={5} className={`${tableCellClass} text-center text-gray-500 dark:text-gray-400`}>Chưa có đơn vị.</td>
                </tr>
              ) : paginate(units, page).map((unit) => (
                <tr key={unit.id}>
                  <td className={`${tableCellClass} font-medium text-gray-800 dark:text-white/90`}>{unit.name}</td>
                  <td className={tableCellClass}>{unit.code}</td>
                  <td className={tableCellClass}>{unit.baseUnitId ? `${unit.conversionFactor} ${unitNameById.get(unit.baseUnitId) ?? "đơn vị gốc"}` : "Đơn vị gốc"}</td>
                  <td className={tableCellClass}>{unit.status === "active" ? "Đang dùng" : "Tạm ngưng"}</td>
                  <td className={`${tableCellClass} text-right`}>
                    <div className="inline-flex items-center gap-2">
                      {canUpdate && (
                        <Link to={`/catalog/units/${unit.id}/edit`} aria-label={`Sửa đơn vị ${unit.name}`} title="Sửa đơn vị" className={iconButtonClass}>
                          <PencilIcon className="h-4 w-4" />
                        </Link>
                      )}
                      {canChangeStatus && (
                        <button type="button" disabled={busyId === unit.id} aria-label={`${unit.status === "active" ? "Vô hiệu hóa" : "Kích hoạt"} đơn vị ${unit.name}`} className={rowActionClass} onClick={() => changeUnitStatus(unit)}>
                          {busyId === unit.id ? "Đang xử lý…" : unit.status === "active" ? "Vô hiệu hóa" : "Kích hoạt"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalItems={units.length} onPageChange={setPage} />
      </section>
    </div>
  );
}

export function CategoryCreatePage({ api = catalogApi }: { api?: CatalogClient }) {
  const navigate = useNavigate();
  const { categoryId } = useParams();
  const isEditMode = Boolean(categoryId);
  const [form, setForm] = useState<CategoryFormState>(emptyCategoryForm);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(isEditMode);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!isEditMode || !categoryId) return;
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    api.getCategory(categoryId)
      .then((category) => {
        if (!active) return;
        setForm(categoryFormFor(category));
      })
      .catch((caught) => {
        if (!active) return;
        setError(errorMessage(caught, "Không tìm thấy danh mục cần sửa."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api, categoryId, isEditMode]);

  async function saveCategory(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (isEditMode && categoryId) {
        await api.updateCategory(categoryId, { name: form.name.trim() });
        navigate("/catalog/categories");
      } else {
        await api.createCategory({ code: form.code.trim(), name: form.name.trim() });
        setNotice("Đã tạo danh mục");
        setForm(emptyCategoryForm);
      }
    } catch (caught) {
      setError(errorMessage(caught, isEditMode ? "Không thể cập nhật danh mục." : "Không thể tạo danh mục. Kiểm tra mã danh mục đã tồn tại hay chưa."));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p role="status" className="text-sm text-gray-500 dark:text-gray-400">Đang tải form danh mục…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 text-pretty dark:text-white/90">{isEditMode ? "Sửa danh mục" : "Thêm danh mục"}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{isEditMode ? "Cập nhật tên danh mục hiện có." : "Nhập mã và tên nhóm hàng cần quản lý."}</p>
        </div>
        <Link to="/catalog/categories" className={secondaryButtonClass}>Quay lại</Link>
      </div>
      {error && <p role="alert" className="rounded-lg bg-error-50 p-3 text-sm text-error-700 dark:bg-error-500/15 dark:text-error-400">{error}</p>}
      {notice && <p role="status" className="rounded-lg bg-success-50 p-3 text-sm text-success-700 dark:bg-success-500/15 dark:text-success-400">{notice}</p>}
      <form onSubmit={saveCategory} className={`grid gap-4 sm:grid-cols-2 ${panelClass}`}>
        <label className={labelClass}>
          Mã danh mục (*)
          <input required disabled={isEditMode} autoComplete="off" spellCheck={false} value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} className={inputClass} />
        </label>
        <label className={labelClass}>
          Tên danh mục (*)
          <input required autoComplete="off" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className={inputClass} />
        </label>
        <button type="submit" disabled={busy} className={`${primaryButtonClass} sm:col-span-2 sm:w-fit`}>{isEditMode ? "Lưu thay đổi" : "Tạo danh mục"}</button>
      </form>
    </div>
  );
}

export function UnitCreatePage({ api = catalogApi }: { api?: CatalogClient }) {
  const navigate = useNavigate();
  const { unitId } = useParams();
  const isEditMode = Boolean(unitId);
  const [form, setForm] = useState<UnitFormState>(emptyUnitForm);
  const [units, setUnits] = useState<CatalogUnit[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const baseUnits = units.filter((unit) => !unit.baseUnitId);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.listUnits(),
      isEditMode && unitId ? api.getUnit(unitId) : Promise.resolve(null),
    ])
      .then(([nextUnits, unit]) => {
        if (!active) return;
        setUnits(nextUnits);
        if (unit) setForm(unitFormFor(unit));
      })
      .catch((caught) => {
        if (!active) return;
        setError(errorMessage(caught, isEditMode ? "Không tìm thấy đơn vị cần sửa." : "Không thể tải đơn vị gốc. Hãy thử tải lại trang."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api, isEditMode, unitId]);

  async function saveUnit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (isEditMode && unitId) {
        await api.updateUnit(unitId, { name: form.name.trim() });
        navigate("/catalog/units");
      } else {
        const input = form.mode === "base"
          ? { code: form.code.trim(), name: form.name.trim() }
          : {
            code: form.code.trim(),
            name: form.name.trim(),
            baseUnitId: form.baseUnitId,
            conversionFactor: form.conversionFactor,
          };
        const createdUnit = await api.createUnit(input);
        setUnits((current) => [createdUnit, ...current]);
        setNotice("Đã tạo đơn vị");
        setForm(emptyUnitForm);
      }
    } catch (caught) {
      setError(errorMessage(caught, isEditMode ? "Không thể cập nhật đơn vị." : "Không thể tạo đơn vị. Kiểm tra mã hoặc cấu hình quy đổi."));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p role="status" className="text-sm text-gray-500 dark:text-gray-400">Đang tải đơn vị…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 text-pretty dark:text-white/90">{isEditMode ? "Sửa đơn vị" : "Thêm đơn vị"}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{isEditMode ? "Cập nhật tên đơn vị hiện có." : "Tạo đơn vị gốc hoặc đơn vị quy đổi từ đơn vị gốc."}</p>
        </div>
        <Link to="/catalog/units" className={secondaryButtonClass}>Quay lại</Link>
      </div>
      {error && <p role="alert" className="rounded-lg bg-error-50 p-3 text-sm text-error-700 dark:bg-error-500/15 dark:text-error-400">{error}</p>}
      {notice && <p role="status" className="rounded-lg bg-success-50 p-3 text-sm text-success-700 dark:bg-success-500/15 dark:text-success-400">{notice}</p>}
      <form onSubmit={saveUnit} className={`grid gap-4 sm:grid-cols-2 ${panelClass}`}>
        <label className={labelClass}>
          Mã đơn vị (*)
          <input required disabled={isEditMode} autoComplete="off" spellCheck={false} value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} className={inputClass} />
        </label>
        <label className={labelClass}>
          Tên đơn vị (*)
          <input required autoComplete="off" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className={inputClass} />
        </label>
        <label className={labelClass}>
          Loại đơn vị
          <select disabled={isEditMode} value={form.mode} onChange={(event) => setForm((current) => ({ ...current, mode: event.target.value as UnitFormState["mode"], baseUnitId: "", conversionFactor: "" }))} className={inputClass}>
            <option value="base">Đơn vị gốc</option>
            <option value="conversion">Đơn vị quy đổi</option>
          </select>
        </label>
        {form.mode === "conversion" && (
          <>
            <label className={labelClass}>
              Đơn vị gốc (*)
              <select required disabled={isEditMode} value={form.baseUnitId} onChange={(event) => setForm((current) => ({ ...current, baseUnitId: event.target.value }))} className={inputClass}>
                <option value="">Chọn đơn vị gốc</option>
                {baseUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
              </select>
            </label>
            <label className={labelClass}>
              Hệ số quy đổi (*)
              <input required disabled={isEditMode} type="number" min="0.000001" step="0.000001" value={form.conversionFactor} onChange={(event) => setForm((current) => ({ ...current, conversionFactor: event.target.value }))} className={inputClass} />
            </label>
          </>
        )}
        <button type="submit" disabled={busy} className={`${primaryButtonClass} sm:col-span-2 sm:w-fit`}>{isEditMode ? "Lưu thay đổi" : "Tạo đơn vị"}</button>
      </form>
    </div>
  );
}

function SpecDefinitionSummary({ definition }: { definition: CategorySpecDefinition }) {
  const detailParts = [
    definition.required ? "Bắt buộc" : "Không bắt buộc",
    definition.type === "number" && definition.unit ? `Đơn vị: ${definition.unit}` : null,
    definition.type === "number" && definition.minValue ? `Min: ${definition.minValue}` : null,
    definition.type === "number" && definition.maxValue ? `Max: ${definition.maxValue}` : null,
  ].filter(Boolean);

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-gray-800 dark:text-white/90">{definition.name}</span>
        <span className="rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-600 dark:bg-white/5 dark:text-gray-300">{definition.code}</span>
        <span className="rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-600 dark:bg-white/5 dark:text-gray-300">{specTypeLabels[definition.type]}</span>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400">{detailParts.join(" • ") || "Không có ràng buộc thêm"}</p>
    </div>
  );
}

export function CategorySpecPage({ api = catalogApi, permissions = ["*"] }: CatalogListProps) {
  const { categoryId } = useParams();
  const [category, setCategory] = useState<CatalogCategory | null>(null);
  const [definitions, setDefinitions] = useState<CategorySpecDefinition[]>([]);
  const [loading, setLoading] = useState(Boolean(categoryId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(categoryId ? "" : "Không tìm thấy danh mục.");
  const [form, setForm] = useState<SpecDefinitionFormState>(emptySpecDefinitionForm);
  const [editingDefinitionId, setEditingDefinitionId] = useState<string | null>(null);
  const [editingDefinitionForm, setEditingDefinitionForm] = useState<SpecDefinitionUpdateFormState | null>(null);
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [editingOptionForm, setEditingOptionForm] = useState<SpecOptionUpdateFormState | null>(null);
  const [newOptionByDefinitionId, setNewOptionByDefinitionId] = useState<Record<string, SpecOptionFormState>>({});
  const canCreate = hasPermission(permissions, "catalog.specs.create");
  const canUpdate = hasPermission(permissions, "catalog.specs.update");
  const canDelete = hasPermission(permissions, "catalog.specs.delete");

  useEffect(() => {
    if (!categoryId) return;
    let active = true;
    Promise.all([api.getCategory(categoryId), api.listCategorySpecDefinitions(categoryId)])
      .then(([nextCategory, nextDefinitions]) => {
        if (!active) return;
        setCategory(nextCategory);
        setDefinitions(nextDefinitions.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)));
      })
      .catch((caught) => {
        if (!active) return;
        setError(errorMessage(caught, "Không thể tải thông số của danh mục."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api, categoryId]);

  function resetCreateForm(type: CategorySpecType = "text") {
    setForm({ ...emptySpecDefinitionForm, type });
  }

  function refreshDefinition(updatedDefinition: CategorySpecDefinition) {
    setDefinitions((current) => current
      .map((definition) => definition.id === updatedDefinition.id ? updatedDefinition : definition)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)));
  }

  async function submitDefinition(event: FormEvent) {
    event.preventDefault();
    if (!categoryId) return;
    setBusy(true);
    setError("");
    try {
      const created = await api.createCategorySpecDefinition(categoryId, normalizeSpecDefinitionForm(form));
      setDefinitions((current) => [...current, created].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)));
      resetCreateForm(form.type);
    } catch (caught) {
      setError(errorMessage(caught, "Không thể tạo thông số."));
    } finally {
      setBusy(false);
    }
  }

  async function submitDefinitionUpdate(event: FormEvent, definition: CategorySpecDefinition) {
    event.preventDefault();
    if (!editingDefinitionForm) return;
    setBusy(true);
    setError("");
    try {
      const updated = await api.updateCategorySpecDefinition(definition.id, normalizeSpecDefinitionUpdateForm(editingDefinitionForm));
      refreshDefinition(updated);
      setEditingDefinitionId(null);
      setEditingDefinitionForm(null);
    } catch (caught) {
      setError(errorMessage(caught, "Không thể cập nhật thông số."));
    } finally {
      setBusy(false);
    }
  }

  async function toggleDefinitionStatus(definition: CategorySpecDefinition) {
    const nextStatus = definition.status === "active" ? "inactive" : "active";
    setBusy(true);
    setError("");
    try {
      const updated = await api.setCategorySpecDefinitionStatus(definition.id, nextStatus);
      refreshDefinition(updated);
    } catch (caught) {
      setError(errorMessage(caught, "Không thể cập nhật trạng thái thông số."));
    } finally {
      setBusy(false);
    }
  }

  async function submitOption(event: FormEvent, definitionId: string) {
    event.preventDefault();
    const currentForm = newOptionByDefinitionId[definitionId] ?? emptySpecOptionForm;
    setBusy(true);
    setError("");
    try {
      const option = await api.createCategorySpecOption(definitionId, {
        value: currentForm.value.trim(),
        label: currentForm.label.trim(),
        sortOrder: Number(currentForm.sortOrder || "0"),
      });
      setDefinitions((current) => current.map((definition) => definition.id !== definitionId
        ? definition
        : {
          ...definition,
          options: [...definition.options, option].sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label)),
        }));
      setNewOptionByDefinitionId((current) => ({ ...current, [definitionId]: emptySpecOptionForm }));
    } catch (caught) {
      setError(errorMessage(caught, "Không thể thêm lựa chọn."));
    } finally {
      setBusy(false);
    }
  }

  async function submitOptionUpdate(event: FormEvent, definitionId: string, optionId: string) {
    event.preventDefault();
    if (!editingOptionForm) return;
    setBusy(true);
    setError("");
    try {
      const option = await api.updateCategorySpecOption(optionId, {
        label: editingOptionForm.label.trim(),
        sortOrder: Number(editingOptionForm.sortOrder || "0"),
      });
      setDefinitions((current) => current.map((definition) => definition.id !== definitionId
        ? definition
        : {
          ...definition,
          options: definition.options.map((item) => item.id === option.id ? option : item).sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label)),
        }));
      setEditingOptionId(null);
      setEditingOptionForm(null);
    } catch (caught) {
      setError(errorMessage(caught, "Không thể cập nhật lựa chọn."));
    } finally {
      setBusy(false);
    }
  }

  async function toggleOptionStatus(definitionId: string, option: CategorySpecOption) {
    setBusy(true);
    setError("");
    try {
      const updated = await api.setCategorySpecOptionStatus(option.id, option.status === "active" ? "inactive" : "active");
      setDefinitions((current) => current.map((definition) => definition.id !== definitionId
        ? definition
        : {
          ...definition,
          options: definition.options.map((item) => item.id === updated.id ? updated : item),
        }));
    } catch (caught) {
      setError(errorMessage(caught, "Không thể cập nhật trạng thái lựa chọn."));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p role="status" className="text-sm text-gray-500 dark:text-gray-400">Đang tải thông số…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 text-pretty dark:text-white/90">Thuộc tính sản phẩm</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Cấu hình thông số cho danh mục {category?.name ?? "đang chọn"}.</p>
        </div>
        <Link to="/catalog/categories" className={secondaryButtonClass}>Quay lại</Link>
      </div>

      {error && <p role="alert" className="rounded-lg bg-error-50 p-3 text-sm text-error-700 dark:bg-error-500/15 dark:text-error-400">{error}</p>}

      {canCreate && (
        <form onSubmit={submitDefinition} className={`space-y-4 ${panelClass}`}>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">Thêm thông số</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className={labelClass}>Mã thông số (*)<input required value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} className={inputClass} /></label>
            <label className={labelClass}>Tên thông số (*)<input required value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className={inputClass} /></label>
            <label className={labelClass}>Loại thông số (*)<select value={form.type} onChange={(event) => resetCreateForm(event.target.value as CategorySpecType)} className={inputClass}>
              {Object.entries(specTypeLabels).map(([type, label]) => <option key={type} value={type}>{label}</option>)}
            </select></label>
            <label className={labelClass}>Thứ tự<input type="number" min="0" value={form.sortOrder} onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))} className={inputClass} /></label>
            <label className="flex items-center gap-3 pt-8 text-sm font-medium text-gray-700 dark:text-gray-300"><input type="checkbox" checked={form.required} onChange={(event) => setForm((current) => ({ ...current, required: event.target.checked }))} /> Bắt buộc (*)</label>
            {form.type === "number" && (
              <>
                <label className={labelClass}>Đơn vị<input value={form.unit} onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value }))} className={inputClass} /></label>
                <label className={labelClass}>Giá trị nhỏ nhất<input type="number" value={form.minValue} onChange={(event) => setForm((current) => ({ ...current, minValue: event.target.value }))} className={inputClass} /></label>
                <label className={labelClass}>Giá trị lớn nhất<input type="number" value={form.maxValue} onChange={(event) => setForm((current) => ({ ...current, maxValue: event.target.value }))} className={inputClass} /></label>
              </>
            )}
          </div>
          {form.type === "select" && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-white/90">Lựa chọn (*)</h3>
              {form.options.map((option, index) => (
                <div key={index} className="grid gap-3 rounded-xl border border-gray-200 p-3 sm:grid-cols-3 dark:border-gray-800">
                  <label className={labelClass}>Giá trị (*)<input required value={option.value} onChange={(event) => setForm((current) => ({ ...current, options: current.options.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item) }))} className={inputClass} /></label>
                  <label className={labelClass}>Nhãn (*)<input required value={option.label} onChange={(event) => setForm((current) => ({ ...current, options: current.options.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item) }))} className={inputClass} /></label>
                  <label className={labelClass}>Thứ tự<input type="number" min="0" value={option.sortOrder} onChange={(event) => setForm((current) => ({ ...current, options: current.options.map((item, itemIndex) => itemIndex === index ? { ...item, sortOrder: event.target.value } : item) }))} className={inputClass} /></label>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <button type="button" className={secondaryButtonClass} onClick={() => setForm((current) => ({ ...current, options: [...current.options, { value: "", label: "", sortOrder: String(current.options.length) }] }))}>Thêm lựa chọn</button>
              </div>
            </div>
          )}
          <button type="submit" disabled={busy} className={primaryButtonClass}>Lưu thông số</button>
        </form>
      )}

      <section className={panelClass}>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">Thông số hiện có</h2>
        <div className="mt-4 space-y-4">
          {definitions.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Danh mục này chưa có thông số.</p>
          ) : definitions.map((definition) => (
            <div key={definition.id} className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
              {editingDefinitionId === definition.id && editingDefinitionForm ? (
                <form className="space-y-4" onSubmit={(event) => submitDefinitionUpdate(event, definition)}>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <label className={labelClass}>Tên thông số (*)<input required value={editingDefinitionForm.name} onChange={(event) => setEditingDefinitionForm((current) => current ? { ...current, name: event.target.value } : current)} className={inputClass} /></label>
                    <label className={labelClass}>Thứ tự<input type="number" min="0" value={editingDefinitionForm.sortOrder} onChange={(event) => setEditingDefinitionForm((current) => current ? { ...current, sortOrder: event.target.value } : current)} className={inputClass} /></label>
                    <label className="flex items-center gap-3 pt-8 text-sm font-medium text-gray-700 dark:text-gray-300"><input type="checkbox" checked={editingDefinitionForm.required} onChange={(event) => setEditingDefinitionForm((current) => current ? { ...current, required: event.target.checked } : current)} /> Bắt buộc (*)</label>
                    {definition.type === "number" && (
                      <>
                        <label className={labelClass}>Đơn vị<input value={editingDefinitionForm.unit} onChange={(event) => setEditingDefinitionForm((current) => current ? { ...current, unit: event.target.value } : current)} className={inputClass} /></label>
                        <label className={labelClass}>Giá trị nhỏ nhất<input type="number" value={editingDefinitionForm.minValue} onChange={(event) => setEditingDefinitionForm((current) => current ? { ...current, minValue: event.target.value } : current)} className={inputClass} /></label>
                        <label className={labelClass}>Giá trị lớn nhất<input type="number" value={editingDefinitionForm.maxValue} onChange={(event) => setEditingDefinitionForm((current) => current ? { ...current, maxValue: event.target.value } : current)} className={inputClass} /></label>
                      </>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="submit" disabled={busy} className={primaryButtonClass}>Lưu thay đổi</button>
                    <button type="button" disabled={busy} className={secondaryButtonClass} onClick={() => { setEditingDefinitionId(null); setEditingDefinitionForm(null); }}>Hủy</button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <SpecDefinitionSummary definition={definition} />
                    <div className="flex flex-wrap gap-2">
                      {canUpdate && <button type="button" className={rowActionClass} onClick={() => { setEditingDefinitionId(definition.id); setEditingDefinitionForm(definitionUpdateFormFor(definition)); }}>Sửa</button>}
                      {canDelete && <button type="button" className={rowActionClass} onClick={() => toggleDefinitionStatus(definition)}>{definition.status === "active" ? "Vô hiệu hóa" : "Kích hoạt"}</button>}
                    </div>
                  </div>
                  {definition.type === "select" && (
                    <div className="mt-4 space-y-3">
                      <div className="rounded-lg border border-gray-200 dark:border-gray-800">
                        <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800">
                          <thead className={tableHeadClass}>
                            <tr>
                              <th className="px-4 py-3">Giá trị</th>
                              <th className="px-4 py-3">Nhãn</th>
                              <th className="px-4 py-3">Thứ tự</th>
                              <th className="px-4 py-3">Trạng thái</th>
                              <th className="px-4 py-3 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {definition.options.map((option) => (
                              <tr key={option.id}>
                                <td className={tableCellClass}>{option.value}</td>
                                <td className={tableCellClass}>
                                  {editingOptionId === option.id && editingOptionForm ? (
                                    <form className="flex flex-wrap items-center gap-2" onSubmit={(event) => submitOptionUpdate(event, definition.id, option.id)}>
                                      <input value={editingOptionForm.label} onChange={(event) => setEditingOptionForm((current) => current ? { ...current, label: event.target.value } : current)} className="h-9 min-w-40 rounded-lg border border-gray-300 px-2 text-sm outline-none focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-100 dark:border-gray-700 dark:bg-gray-900" />
                                      <input type="number" min="0" value={editingOptionForm.sortOrder} onChange={(event) => setEditingOptionForm((current) => current ? { ...current, sortOrder: event.target.value } : current)} className="h-9 w-24 rounded-lg border border-gray-300 px-2 text-sm outline-none focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-100 dark:border-gray-700 dark:bg-gray-900" />
                                      <button type="submit" className={rowActionClass}>Lưu</button>
                                      <button type="button" className={rowActionClass} onClick={() => { setEditingOptionId(null); setEditingOptionForm(null); }}>Hủy</button>
                                    </form>
                                  ) : option.label}
                                </td>
                                <td className={tableCellClass}>{option.sortOrder}</td>
                                <td className={tableCellClass}>{option.status === "active" ? "Đang dùng" : "Tạm ngưng"}</td>
                                <td className={`${tableCellClass} text-right`}>
                                  <div className="inline-flex gap-2">
                                    {canUpdate && editingOptionId !== option.id && <button type="button" className={rowActionClass} onClick={() => { setEditingOptionId(option.id); setEditingOptionForm(optionUpdateFormFor(option)); }}>Sửa</button>}
                                    {canDelete && <button type="button" className={rowActionClass} onClick={() => toggleOptionStatus(definition.id, option)}>{option.status === "active" ? "Vô hiệu hóa" : "Kích hoạt"}</button>}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {canCreate && (
                        <form className="grid gap-3 rounded-xl bg-gray-50 p-3 sm:grid-cols-4 dark:bg-white/[0.03]" onSubmit={(event) => submitOption(event, definition.id)}>
                          <label className={labelClass}>Giá trị (*)<input required value={(newOptionByDefinitionId[definition.id] ?? emptySpecOptionForm).value} onChange={(event) => setNewOptionByDefinitionId((current) => ({ ...current, [definition.id]: { ...(current[definition.id] ?? emptySpecOptionForm), value: event.target.value } }))} className={inputClass} /></label>
                          <label className={labelClass}>Nhãn (*)<input required value={(newOptionByDefinitionId[definition.id] ?? emptySpecOptionForm).label} onChange={(event) => setNewOptionByDefinitionId((current) => ({ ...current, [definition.id]: { ...(current[definition.id] ?? emptySpecOptionForm), label: event.target.value } }))} className={inputClass} /></label>
                          <label className={labelClass}>Thứ tự<input type="number" min="0" value={(newOptionByDefinitionId[definition.id] ?? emptySpecOptionForm).sortOrder} onChange={(event) => setNewOptionByDefinitionId((current) => ({ ...current, [definition.id]: { ...(current[definition.id] ?? emptySpecOptionForm), sortOrder: event.target.value } }))} className={inputClass} /></label>
                          <div className="flex items-end"><button type="submit" disabled={busy} className={primaryButtonClass}>Thêm lựa chọn</button></div>
                        </form>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
