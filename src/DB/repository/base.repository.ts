import {
  HydratedDocument,
  Model,
  CreateOptions,
  UpdateWithAggregationPipeline,
  mongo,
  PopulateOptions,
} from "mongoose";
import type {
  QueryFilter,
  QueryOptions,
  ProjectionType,
  UpdateQuery,
  FlattenMaps,
} from "mongoose";
import { BadRequestException } from "../../common/exceptions";

type UpdateQueryOptions<T> = NonNullable<Parameters<Model<T>["updateOne"]>[2]>;
type DeleteQueryOptions<T> = NonNullable<Parameters<Model<T>["deleteOne"]>[1]>;

export abstract class DatabaseRepository<TRawDoc> {
  constructor(protected readonly model: Model<TRawDoc>) { }

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── Create ────────────────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Overload 1 — single document.
   * Pass a single `data` object → returns one `HydratedDocument`.
   *
   * Overload 2 — multiple documents.
   * Pass an array of `data` objects → returns `HydratedDocument[]`.
   * Accepts optional `CreateOptions`
   *
   * Internally always uses the array form of `model.create()` so Mongoose
   * runs schema validators and middleware on every document consistently.
   */
  async create(args: {
    data: Partial<TRawDoc>;
  }): Promise<HydratedDocument<TRawDoc>>;

  async create(args: {
    data: Partial<TRawDoc>[];
    options?: CreateOptions;
  }): Promise<HydratedDocument<TRawDoc>[]>;

  async create({
    data,
    options,
  }: {
    data: Partial<TRawDoc> | Partial<TRawDoc>[];
    options?: CreateOptions;
  }): Promise<HydratedDocument<TRawDoc> | HydratedDocument<TRawDoc>[]> {
    if (Array.isArray(data)) {
      return this.model.create(data as any, options);
    }
    const [doc] = await this.model.create([data] as any, options);
    if (!doc) throw new BadRequestException("Failed to create document");
    return doc;
  }

  /**
   * Explicit single-document creation.
   * Prefer this over `create` when you know you're inserting one document —
   * the return type is always `HydratedDocument<TRawDoc>`, no union.
   *
   * @param data    - Fields to insert.
   * @param options - CreateOptions, e.g. `{ session }` for transactions.
   *
   * @throws BadRequestException if Mongoose returns an empty result.
   */
  async createOne({
    data,
    options,
  }: {
    data: Partial<TRawDoc>;
    options?: CreateOptions;
  }): Promise<HydratedDocument<TRawDoc>> {
    const [doc] = await this.model.create([data] as any, {
      ...options,
    });
    if (!doc) throw new BadRequestException("Failed to create document");
    return doc;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── Read ──────────────────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Find a document by its `_id`.
   *
   * Overload 1 — `lean: true`
   * Returns a plain JS object (`FlattenMaps<TRawDoc>`). Faster, no Mongoose
   * overhead. Use when you only need to read data (e.g. API responses).
   *
   * Overload 2 — default (no lean / `lean: false`)
   * Returns a full `HydratedDocument` with Mongoose methods (`save`, virtuals,
   * middleware). Use when you need to mutate and save the document.
   *
   * @param id         - The document `_id` as a string.
   * @param projection - Fields to include/exclude, e.g. `{ password: 0 }`.
   * @param populate   - Relation(s) to populate, e.g. `"role"` or `[{ path: "role" }]`.
   * @param options    - Additional QueryOptions. Pass `{ lean: true }` to get a plain object.
   */
  async findById({
    id,
    projection,
    populate,
    options,
  }: {
    id: string;
    projection?: ProjectionType<TRawDoc>;
    populate?: string | PopulateOptions | PopulateOptions[];
    options: QueryOptions<TRawDoc> & { lean: true };
  }): Promise<FlattenMaps<TRawDoc> | null>;

  async findById({
    id,
    projection,
    populate,
    options,
  }: {
    id: string;
    projection?: ProjectionType<TRawDoc>;
    populate?: string | PopulateOptions | PopulateOptions[];
    options?: QueryOptions<TRawDoc> & { lean?: false };
  }): Promise<HydratedDocument<TRawDoc> | null>;

  async findById({
    id,
    projection,
    populate,
    options,
  }: {
    id: string;
    projection?: ProjectionType<TRawDoc>;
    populate?: string | PopulateOptions | PopulateOptions[];
    options?: QueryOptions<TRawDoc>;
  }): Promise<any> {
    let query = this.model.findById(id, projection, options);
    if (populate) query = query.populate(populate as any);
    return query.exec();
  }

  /**
   * Find the first document matching the filter.
   *
   * Overload 1 — `lean: true`
   * Returns a plain JS object. Skips Mongoose document overhead.
   * Best for read-only use cases (transformations, API serialization).
   *
   * Overload 2 — default (no lean / `lean: false`)
   * Returns a `HydratedDocument`. Use when you need `.save()` or virtuals.
   *
   * @param filter     - MongoDB query filter, e.g. `{ email: "x@y.com" }`.
   * @param projection - Fields to include/exclude, e.g. `{ password: 0 }`.
   * @param populate   - Relation(s) to populate.
   * @param options    - Additional QueryOptions. Pass `{ lean: true }` to get a plain object.
   */
  async findOne({
    filter,
    projection,
    populate,
    options,
  }: {
    filter: QueryFilter<TRawDoc>;
    projection?: ProjectionType<TRawDoc>;
    populate?: string | PopulateOptions | PopulateOptions[];
    options: QueryOptions<TRawDoc> & { lean: true };
  }): Promise<FlattenMaps<TRawDoc> | null>;

  async findOne({
    filter,
    projection,
    populate,
    options,
  }: {
    filter: QueryFilter<TRawDoc>;
    projection?: ProjectionType<TRawDoc>;
    populate?: string | PopulateOptions | PopulateOptions[];
    options?: QueryOptions<TRawDoc> & { lean?: false };
  }): Promise<HydratedDocument<TRawDoc> | null>;

  async findOne({
    filter,
    projection,
    populate,
    options,
  }: {
    filter: QueryFilter<TRawDoc>;
    projection?: ProjectionType<TRawDoc>;
    populate?: string | PopulateOptions | PopulateOptions[];
    options?: QueryOptions<TRawDoc>;
  }): Promise<any> {
    let query = this.model.findOne(filter, projection, options);
    if (populate) query = query.populate(populate as any);
    return query.exec();
  }

  /**
   * Find all documents matching the filter.
   *
   * Overload 1 — `lean: true`
   * Returns plain JS objects. Much faster for large result sets since
   * Mongoose skips document instantiation and middleware.
   *
   * Overload 2 — default (no lean / `lean: false`)
   * Returns `HydratedDocument[]`. Use when you need Mongoose methods on results.
   *
   * @param filter     - MongoDB query filter.
   * @param projection - Fields to include/exclude.
   * @param populate   - Relation(s) to populate.
   * @param sort       - Sort order, e.g. `{ createdAt: -1 }`.
   * @param limit      - Maximum number of documents to return.
   * @param skip       - Number of documents to skip (use with `limit` for pagination).
   * @param options    - Additional QueryOptions. Pass `{ lean: true }` to get plain objects.
   */
  async find({
    filter,
    projection,
    populate,
    sort,
    limit,
    skip,
    options,
  }: {
    filter: QueryFilter<TRawDoc>;
    projection?: ProjectionType<TRawDoc>;
    populate?: string | PopulateOptions | PopulateOptions[];
    sort?: Record<string, 1 | -1>;
    limit?: number;
    skip?: number;
    options: QueryOptions<TRawDoc> & { lean: true };
  }): Promise<FlattenMaps<TRawDoc>[]>;

  async find({
    filter,
    projection,
    populate,
    sort,
    limit,
    skip,
    options,
  }: {
    filter: QueryFilter<TRawDoc>;
    projection?: ProjectionType<TRawDoc>;
    populate?: string | PopulateOptions | PopulateOptions[];
    sort?: Record<string, 1 | -1>;
    limit?: number;
    skip?: number;
    options?: QueryOptions<TRawDoc> & { lean?: false };
  }): Promise<HydratedDocument<TRawDoc>[]>;

  async find({
    filter,
    projection,
    populate,
    sort,
    limit,
    skip,
    options,
  }: {
    filter: QueryFilter<TRawDoc>;
    projection?: ProjectionType<TRawDoc>;
    populate?: string | PopulateOptions | PopulateOptions[];
    sort?: Record<string, 1 | -1>;
    limit?: number;
    skip?: number;
    options?: QueryOptions<TRawDoc>;
  }): Promise<any> {
    let query = this.model.find(filter, projection, options);
    if (populate) query = query.populate(populate as any);
    if (sort) query = query.sort(sort);
    if (limit !== undefined) query = query.limit(limit);
    if (skip !== undefined) query = query.skip(skip);
    return query.exec();
  }

  /**
   * Check whether a document matching the filter exists.
   * More efficient than `findOne` — only fetches `_id`, no full document load.
   *
   * @param filter - MongoDB query filter.
   * @returns `{ _id }` if found, `null` otherwise.
   */
  async exists({
    filter,
  }: {
    filter: QueryFilter<TRawDoc>;
  }): Promise<Pick<mongo.Document, "_id"> | null> {
    return this.model.exists(filter);
  }

  /**
   * Count documents matching the filter.
   * Uses `countDocuments` which respects the filter (unlike `estimatedDocumentCount`).
   *
   * @param filter  - MongoDB query filter.
   */
  async countDocuments({
    filter,
  }: {
    filter: QueryFilter<TRawDoc>;
  }): Promise<number> {
    return this.model.countDocuments(filter);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── Update ────────────────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Find a document by `_id`, apply the update, and return the result.
   * Defaults to `{ new: true }` — returns the document **after** the update.
   * Pass `{ new: false }` in options to get the document **before** the update.
   *
   * @param id      - The document `_id` as a string.
   * @param update  - Update query or aggregation pipeline.
   * @param options - QueryOptions. `new` defaults to `true`.
   */
  async findByIdAndUpdate({
    id,
    update,
    options,
  }: {
    id: string;
    update: UpdateQuery<TRawDoc> | UpdateWithAggregationPipeline;
    options?: QueryOptions<TRawDoc> & { new?: boolean };
  }): Promise<HydratedDocument<TRawDoc> | null> {
    return this.model.findByIdAndUpdate(id, update, {
      new: true,
      ...options,
    });
  }

  /**
   * Find the first document matching the filter, apply the update, and return the result.
   * Defaults to `{ new: true }` — returns the document **after** the update.
   *
   * @param filter  - MongoDB query filter.
   * @param update  - Update query or aggregation pipeline.
   * @param upsert  - If `true`, creates the document if no match is found. Defaults to `false`.
   * @param options - QueryOptions. `new` defaults to `true`.
   */
  async findOneAndUpdate({
    filter,
    update,
    upsert = false,
    options,
  }: {
    filter: QueryFilter<TRawDoc>;
    update: UpdateQuery<TRawDoc> | UpdateWithAggregationPipeline;
    upsert?: boolean;
    options?: QueryOptions<TRawDoc> & { new?: boolean };
  }): Promise<HydratedDocument<TRawDoc> | null> {
    return this.model.findOneAndUpdate(filter, update, {
      new: true,
      upsert,
      ...options,
    });
  }

  /**
   * Update the first document matching the filter.
   * Does NOT return the updated document — use `findOneAndUpdate` if you need it.
   * Returns a `UpdateResult` with `matchedCount` and `modifiedCount`.
   *
   * @param filter  - MongoDB query filter.
   * @param update  - Update query or aggregation pipeline.
   * @param options - Additional update options.
   */
  async updateOne({
    filter,
    update,
    options,
  }: {
    filter: QueryFilter<TRawDoc>;
    update: UpdateQuery<TRawDoc> | UpdateWithAggregationPipeline;
    options?: UpdateQueryOptions<TRawDoc>;
  }): Promise<mongo.UpdateResult> {
    return this.model.updateOne(filter, update, { ...options });
  }

  /**
   * Update all documents matching the filter.
   * Does NOT return the updated documents — use `findMany` after if needed.
   * Returns a `UpdateResult` with `matchedCount` and `modifiedCount`.
   *
   * @param filter  - MongoDB query filter.
   * @param update  - Update query or aggregation pipeline.
   * @param options - Additional update options.
   */
  async updateMany({
    filter,
    update,
    options,
  }: {
    filter: QueryFilter<TRawDoc>;
    update: UpdateQuery<TRawDoc> | UpdateWithAggregationPipeline;
    options?: UpdateQueryOptions<TRawDoc>;
  }): Promise<mongo.UpdateResult> {
    return this.model.updateMany(filter, update, { ...options });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── Delete ────────────────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Find a document by `_id`, delete it, and return the deleted document.
   * Returns `null` if no document matched.
   *
   * @param id      - The document `_id` as a string.
   * @param options - Additional QueryOptions.
   */
  async findByIdAndDelete({
    id,
    options,
  }: {
    id: string;
    options?: QueryOptions<TRawDoc>;
  }): Promise<HydratedDocument<TRawDoc> | null> {
    return this.model.findByIdAndDelete(id, { ...options });
  }

  /**
   * Find the first document matching the filter, delete it, and return the deleted document.
   * Returns `null` if no document matched.
   *
   * @param filter  - MongoDB query filter.
   * @param options - Additional QueryOptions.
   */
  async findOneAndDelete({
    filter,
    options,
  }: {
    filter: QueryFilter<TRawDoc>;
    options?: QueryOptions<TRawDoc>;
  }): Promise<HydratedDocument<TRawDoc> | null> {
    return this.model.findOneAndDelete(filter, { ...options });
  }

  /**
   * Delete the first document matching the filter.
   * Does NOT return the deleted document — use `findOneAndDelete` if you need it.
   * Returns a `DeleteResult` with `deletedCount`.
   *
   * @param filter  - MongoDB query filter.
   * @param options - Additional delete options.
   */
  async deleteOne({
    filter,
    options,
  }: {
    filter: QueryFilter<TRawDoc>;
    options?: DeleteQueryOptions<TRawDoc>;
  }): Promise<mongo.DeleteResult> {
    return this.model.deleteOne(filter, { ...options });
  }

  /**
   * Delete all documents matching the filter.
   * Does NOT return the deleted documents.
   * Returns a `DeleteResult` with `deletedCount`.
   *
   * @param filter  - MongoDB query filter.
   * @param options - Additional delete options.
   */
  async deleteMany({
    filter,
    options,
  }: {
    filter: QueryFilter<TRawDoc>;
    options?: DeleteQueryOptions<TRawDoc>;
  }): Promise<mongo.DeleteResult> {
    return this.model.deleteMany(filter, { ...options });
  }
}