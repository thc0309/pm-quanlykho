import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router";

import { Pagination, paginate } from "../../components/common/Pagination";
import {
  catalogApi,
  type CatalogCategory,
  type CatalogClient,
  type CatalogUnit,
} from "../../lib/api";
import { hasPermission } from "../../lib/permissions";
import { PencilIcon, PlusIcon } from "../../icons";

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

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function CategoriesPage({ api = catalogApi, permissions = ["*"] }: CatalogListProps) {
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [categoryPage, setCategoryPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const canCreate = hasPermission(permissions, "catalog.categories.create");
  const canUpdate = hasPermission(permissions, "catalog.categories.update");
  const canChangeStatus = hasPermission(permissions, "catalog.categories.delete");

  function startEdit(category: CatalogCategory) {
    setEditingId(category.id);
    setDraftName(category.name);
    setRowError(null);
  }

  async function saveCategory(event: FormEvent<HTMLFormElement>, category: CatalogCategory) {
    event.preventDefault();
    setBusyId(category.id);
    setRowError(null);
    try {
      const updated = await api.updateCategory(category.id, { name: draftName.trim() });
      setCategories((current) => current.map((item) => item.id === updated.id ? updated : item));
      setEditingId(null);
    } catch (caught) {
      setRowError({ id: category.id, message: errorMessage(caught, "Không thể cập nhật danh mục") });
    } finally {
      setBusyId(null);
    }
  }

  async function changeCategoryStatus(category: CatalogCategory) {
    const nextStatus = category.status === "active" ? "inactive" : "active";
    const action = nextStatus === "inactive" ? "vô hiệu hóa" : "kích hoạt";
    if (!window.confirm(`Bạn có chắc muốn ${action} danh mục ${category.name}?`)) return;
    setBusyId(category.id);
    setRowError(null);
    try {
      const updated = await api.setCategoryStatus(category.id, nextStatus);
      setCategories((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (caught) {
      setRowError({ id: category.id, message: errorMessage(caught, `Không thể ${action} danh mục`) });
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    api.listCategories()
      .then(setCategories)
      .catch(() => setError("Không thể tải danh mục. Hãy thử tải lại trang."))
      .finally(() => setLoading(false));
  }, [api]);

  if (loading) {
    return <p role="status" className="text-sm text-gray-500 dark:text-gray-400">Đang tải danh mục…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 text-pretty dark:text-white/90">Danh mục</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Quản lý nhóm hàng theo kho.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canCreate && (
            <Link to="/catalog/categories/create" className={primaryButtonClass}>
              <PlusIcon className="h-4 w-4" />
              Thêm danh mục
            </Link>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-error-50 p-3 text-sm text-error-700 dark:bg-error-500/15 dark:text-error-400">
          {error}
        </p>
      )}

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
                  <td colSpan={4} className={`${tableCellClass} text-center text-gray-500 dark:text-gray-400`}>
                    Chưa có danh mục.
                  </td>
                </tr>
              ) : paginate(categories, categoryPage).map((category) => (
                <tr key={category.id}>
                  <td className={`${tableCellClass} min-w-64 font-medium text-gray-800 dark:text-white/90`}>
                    {editingId === category.id ? (
                      <form className="flex items-center gap-2" onSubmit={(event) => saveCategory(event, category)}>
                        <label className="sr-only" htmlFor={`category-name-${category.id}`}>Tên danh mục {category.name}</label>
                        <input
                          id={`category-name-${category.id}`}
                          aria-label={`Tên danh mục ${category.name}`}
                          autoFocus
                          required
                          value={draftName}
                          onChange={(event) => setDraftName(event.target.value)}
                          className="h-9 min-w-36 rounded-lg border border-gray-300 px-2 text-sm outline-none focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-100 dark:border-gray-700 dark:bg-gray-900"
                        />
                        <button type="submit" disabled={busyId === category.id} className={rowActionClass} aria-label={`Lưu danh mục ${category.name}`}>
                          {busyId === category.id ? "Đang lưu…" : "Lưu"}
                        </button>
                        <button type="button" disabled={busyId === category.id} className={rowActionClass} onClick={() => setEditingId(null)}>Hủy</button>
                      </form>
                    ) : category.name}
                    {rowError?.id === category.id && <p role="alert" className="mt-1 text-xs font-normal text-error-600">{rowError.message}</p>}
                  </td>
                  <td className={tableCellClass}>{category.code}</td>
                  <td className={tableCellClass}>{category.status === "active" ? "Đang dùng" : "Tạm ngưng"}</td>
                  <td className={`${tableCellClass} text-right`}>
                    <div className="inline-flex items-center gap-2">
                      {canUpdate && editingId !== category.id && (
                        <button type="button" disabled={busyId === category.id} aria-label={`Sửa danh mục ${category.name}`} title="Sửa danh mục" className={iconButtonClass} onClick={() => startEdit(category)}>
                          <PencilIcon className="h-4 w-4" />
                        </button>
                      )}
                      {canChangeStatus && (
                        <button
                          type="button"
                          disabled={busyId === category.id}
                          aria-label={`${category.status === "active" ? "Vô hiệu hóa" : "Kích hoạt"} danh mục ${category.name}`}
                          className={rowActionClass}
                          onClick={() => changeCategoryStatus(category)}
                        >
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
        <Pagination page={categoryPage} totalItems={categories.length} onPageChange={setCategoryPage} />
      </section>
    </div>
  );
}

export function UnitsPage({ api = catalogApi, permissions = ["*"] }: CatalogListProps) {
  const [units, setUnits] = useState<CatalogUnit[]>([]);
  const [unitPage, setUnitPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const unitNameById = useMemo(() => new Map(units.map((unit) => [unit.id, unit.name])), [units]);
  const canCreate = hasPermission(permissions, "catalog.units.create");
  const canUpdate = hasPermission(permissions, "catalog.units.update");
  const canChangeStatus = hasPermission(permissions, "catalog.units.delete");

  function startEdit(unit: CatalogUnit) {
    setEditingId(unit.id);
    setDraftName(unit.name);
    setRowError(null);
  }

  async function saveUnit(event: FormEvent<HTMLFormElement>, unit: CatalogUnit) {
    event.preventDefault();
    setBusyId(unit.id);
    setRowError(null);
    try {
      const updated = await api.updateUnit(unit.id, { name: draftName.trim() });
      setUnits((current) => current.map((item) => item.id === updated.id ? updated : item));
      setEditingId(null);
    } catch (caught) {
      setRowError({ id: unit.id, message: errorMessage(caught, "Không thể cập nhật đơn vị") });
    } finally {
      setBusyId(null);
    }
  }

  async function changeUnitStatus(unit: CatalogUnit) {
    const nextStatus = unit.status === "active" ? "inactive" : "active";
    const action = nextStatus === "inactive" ? "vô hiệu hóa" : "kích hoạt";
    if (!window.confirm(`Bạn có chắc muốn ${action} đơn vị ${unit.name}?`)) return;
    setBusyId(unit.id);
    setRowError(null);
    try {
      const updated = await api.setUnitStatus(unit.id, nextStatus);
      setUnits((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (caught) {
      setRowError({ id: unit.id, message: errorMessage(caught, `Không thể ${action} đơn vị`) });
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    api.listUnits()
      .then(setUnits)
      .catch(() => setError("Không thể tải đơn vị. Hãy thử tải lại trang."))
      .finally(() => setLoading(false));
  }, [api]);

  if (loading) {
    return <p role="status" className="text-sm text-gray-500 dark:text-gray-400">Đang tải đơn vị…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 text-pretty dark:text-white/90">Đơn vị</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Quản lý đơn vị gốc và đơn vị quy đổi.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canCreate && (
            <Link to="/catalog/units/create" className={primaryButtonClass}>
              <PlusIcon className="h-4 w-4" />
              Thêm đơn vị
            </Link>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-error-50 p-3 text-sm text-error-700 dark:bg-error-500/15 dark:text-error-400">
          {error}
        </p>
      )}

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
                  <td colSpan={5} className={`${tableCellClass} text-center text-gray-500 dark:text-gray-400`}>
                    Chưa có đơn vị.
                  </td>
                </tr>
              ) : paginate(units, unitPage).map((unit) => (
                <tr key={unit.id}>
                  <td className={`${tableCellClass} min-w-64 font-medium text-gray-800 dark:text-white/90`}>
                    {editingId === unit.id ? (
                      <form className="flex items-center gap-2" onSubmit={(event) => saveUnit(event, unit)}>
                        <label className="sr-only" htmlFor={`unit-name-${unit.id}`}>Tên đơn vị {unit.name}</label>
                        <input
                          id={`unit-name-${unit.id}`}
                          aria-label={`Tên đơn vị ${unit.name}`}
                          autoFocus
                          required
                          value={draftName}
                          onChange={(event) => setDraftName(event.target.value)}
                          className="h-9 min-w-36 rounded-lg border border-gray-300 px-2 text-sm outline-none focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-100 dark:border-gray-700 dark:bg-gray-900"
                        />
                        <button type="submit" disabled={busyId === unit.id} className={rowActionClass} aria-label={`Lưu đơn vị ${unit.name}`}>
                          {busyId === unit.id ? "Đang lưu…" : "Lưu"}
                        </button>
                        <button type="button" disabled={busyId === unit.id} className={rowActionClass} onClick={() => setEditingId(null)}>Hủy</button>
                      </form>
                    ) : unit.name}
                    {rowError?.id === unit.id && <p role="alert" className="mt-1 text-xs font-normal text-error-600">{rowError.message}</p>}
                  </td>
                  <td className={tableCellClass}>{unit.code}</td>
                  <td className={tableCellClass}>
                    {unit.baseUnitId ? `${unit.conversionFactor} ${unitNameById.get(unit.baseUnitId) ?? "đơn vị gốc"}` : "Đơn vị gốc"}
                  </td>
                  <td className={tableCellClass}>{unit.status === "active" ? "Đang dùng" : "Tạm ngưng"}</td>
                  <td className={`${tableCellClass} text-right`}>
                    <div className="inline-flex items-center gap-2">
                      {canUpdate && editingId !== unit.id && (
                        <button type="button" disabled={busyId === unit.id} aria-label={`Sửa đơn vị ${unit.name}`} title="Sửa đơn vị" className={iconButtonClass} onClick={() => startEdit(unit)}>
                          <PencilIcon className="h-4 w-4" />
                        </button>
                      )}
                      {canChangeStatus && (
                        <button
                          type="button"
                          disabled={busyId === unit.id}
                          aria-label={`${unit.status === "active" ? "Vô hiệu hóa" : "Kích hoạt"} đơn vị ${unit.name}`}
                          className={rowActionClass}
                          onClick={() => changeUnitStatus(unit)}
                        >
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
        <Pagination page={unitPage} totalItems={units.length} onPageChange={setUnitPage} />
      </section>
    </div>
  );
}

export function CategoryCreatePage({ api = catalogApi }: { api?: CatalogClient }) {
  const [form, setForm] = useState({ code: "", name: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function createCategory(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.createCategory(form);
      setNotice("Đã tạo danh mục");
      setForm({ code: "", name: "" });
    } catch {
      setError("Không thể tạo danh mục. Kiểm tra mã danh mục đã tồn tại hay chưa.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 text-pretty dark:text-white/90">Thêm danh mục</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Nhập mã và tên nhóm hàng cần quản lý.
          </p>
        </div>
        <Link to="/catalog/categories" className={secondaryButtonClass}>Quay lại</Link>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-error-50 p-3 text-sm text-error-700 dark:bg-error-500/15 dark:text-error-400">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-lg bg-success-50 p-3 text-sm text-success-700 dark:bg-success-500/15 dark:text-success-400">
          {notice}
        </p>
      )}

      <form onSubmit={createCategory} className={`grid gap-4 sm:grid-cols-2 ${panelClass}`}>
        <label className={labelClass}>
          Mã danh mục (*)
          <input
            name="categoryCode"
            required
            autoComplete="off"
            spellCheck={false}
            value={form.code}
            onChange={(event) => setForm({ ...form, code: event.target.value })}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Tên danh mục (*)
          <input
            name="categoryName"
            required
            autoComplete="off"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            className={inputClass}
          />
        </label>
        <button type="submit" disabled={busy} className={`${primaryButtonClass} sm:col-span-2 sm:w-fit`}>
          Tạo danh mục
        </button>
      </form>
    </div>
  );
}

export function UnitCreatePage({ api = catalogApi }: { api?: CatalogClient }) {
  const [form, setForm] = useState({ code: "", name: "", mode: "base", baseUnitId: "", conversionFactor: "" });
  const [units, setUnits] = useState<CatalogUnit[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const baseUnits = units.filter((unit) => !unit.baseUnitId);

  useEffect(() => {
    api.listUnits()
      .then(setUnits)
      .catch(() => setError("Không thể tải đơn vị gốc. Hãy thử tải lại trang."))
      .finally(() => setLoading(false));
  }, [api]);

  async function createUnit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const input = form.mode === "base"
        ? { code: form.code, name: form.name }
        : {
          code: form.code,
          name: form.name,
          baseUnitId: form.baseUnitId,
          conversionFactor: form.conversionFactor,
        };
      const createdUnit = await api.createUnit(input);
      setUnits((current) => [createdUnit, ...current]);
      setNotice("Đã tạo đơn vị");
      setForm({ code: "", name: "", mode: "base", baseUnitId: "", conversionFactor: "" });
    } catch {
      setError("Không thể tạo đơn vị. Kiểm tra mã hoặc cấu hình quy đổi.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p role="status" className="text-sm text-gray-500 dark:text-gray-400">Đang tải đơn vị…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 text-pretty dark:text-white/90">Thêm đơn vị</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Tạo đơn vị gốc hoặc đơn vị quy đổi từ đơn vị gốc.
          </p>
        </div>
        <Link to="/catalog/units" className={secondaryButtonClass}>Quay lại</Link>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-error-50 p-3 text-sm text-error-700 dark:bg-error-500/15 dark:text-error-400">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-lg bg-success-50 p-3 text-sm text-success-700 dark:bg-success-500/15 dark:text-success-400">
          {notice}
        </p>
      )}

      <form onSubmit={createUnit} className={`grid gap-4 sm:grid-cols-2 ${panelClass}`}>
        <label className={labelClass}>
          Mã đơn vị (*)
          <input
            name="unitCode"
            required
            autoComplete="off"
            spellCheck={false}
            value={form.code}
            onChange={(event) => setForm({ ...form, code: event.target.value })}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Tên đơn vị (*)
          <input
            name="unitName"
            required
            autoComplete="off"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Loại đơn vị
          <select
            name="unitMode"
            value={form.mode}
            onChange={(event) => setForm({ ...form, mode: event.target.value, baseUnitId: "", conversionFactor: "" })}
            className={inputClass}
          >
            <option value="base">Đơn vị gốc</option>
            <option value="conversion">Đơn vị quy đổi</option>
          </select>
        </label>
        {form.mode === "conversion" && (
          <>
            <label className={labelClass}>
              Đơn vị gốc (*)
              <select
                name="baseUnit"
                required
                value={form.baseUnitId}
                onChange={(event) => setForm({ ...form, baseUnitId: event.target.value })}
                className={inputClass}
              >
                <option value="">Chọn đơn vị gốc</option>
                {baseUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>{unit.name}</option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              Hệ số quy đổi (*)
              <input
                name="conversionFactor"
                required
                type="number"
                min="0.000001"
                step="0.000001"
                value={form.conversionFactor}
                onChange={(event) => setForm({ ...form, conversionFactor: event.target.value })}
                className={inputClass}
              />
            </label>
          </>
        )}
        <button type="submit" disabled={busy} className={`${primaryButtonClass} sm:col-span-2 sm:w-fit`}>
          Tạo đơn vị
        </button>
      </form>
    </div>
  );
}
