import { createElement, ReactElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GalleryContainerProps } from "../typings/GalleryProps";
import { Gallery as GalleryComponent } from "./components/Gallery";
import {
    FilterType,
    SortInstruction,
    SortFunction,
    useFilterContext,
    useMultipleFiltering,
    useSortContext
} from "@mendix/pluggable-widgets-commons/components/web";
import { FilterCondition } from "mendix/filters";
import { extractFilters } from "./utils/filters";
import { and } from "mendix/filters/builders";
import {
    executeAction,
    getGlobalSelectionContext,
    useCreateSelectionContextValue,
    useSelectionHelper
} from "@mendix/pluggable-widgets-commons";

export function Gallery(props: GalleryContainerProps): ReactElement {
    const viewStateFilters = useRef<FilterCondition | undefined>(undefined);
    const viewStateSort = useRef<SortInstruction[] | undefined>(undefined);
    const [filtered, setFiltered] = useState(false);
    const [sorted, setSorted] = useState(false);
    const customFiltersState = useMultipleFiltering();
    const [sortState, setSortState] = useState<SortFunction>();
    const { FilterContext } = useFilterContext();
    const { SortContext } = useSortContext();
    const SelectionContext = getGlobalSelectionContext();
    const isInfiniteLoad = props.pagination === "virtualScrolling";
    const currentPage = isInfiniteLoad
        ? props.datasource.limit / props.pageSize
        : props.datasource.offset / props.pageSize;

    useEffect(() => {
        props.datasource.requestTotalCount(true);
        if (props.datasource.limit === Number.POSITIVE_INFINITY) {
            props.datasource.setLimit(props.pageSize);
        }
    }, [props.datasource, props.pageSize]);

    useEffect(() => {
        if (props.datasource.filter && !filtered && !viewStateFilters.current) {
            viewStateFilters.current = props.datasource.filter;
        }
        if (props.datasource.sortOrder && !sorted && !viewStateSort.current) {
            viewStateSort.current = props.datasource.sortOrder;
        }
    }, [props.datasource, filtered, sorted]);

    const filterList = useMemo(
        () => props.filterList.reduce((filters, { filter }) => ({ ...filters, [filter.id]: filter }), {}),
        [props.filterList]
    );

    const sortList = useMemo(
        () =>
            props.sortList.map(({ attribute, caption }) => ({
                attribute,
                caption: caption.value ?? ""
            })),
        [props.sortList]
    );

    const initialFilters = useMemo(
        () =>
            props.filterList.reduce(
                (filters, { filter }) => ({
                    ...filters,
                    [filter.id]: extractFilters(filter, viewStateFilters.current)
                }),
                {}
            ),
        [props.filterList, viewStateFilters.current]
    );

    const filters = Object.keys(customFiltersState)
        .map((key: FilterType) => customFiltersState[key][0]?.getFilterCondition())
        .filter((filter): filter is FilterCondition => filter !== undefined);

    if (filters.length > 0) {
        props.datasource.setFilter(filters.length > 1 ? and(...filters) : filters[0]);
    } else if (filtered) {
        props.datasource.setFilter(undefined);
    } else {
        props.datasource.setFilter(viewStateFilters.current);
    }

    if (sortState && "getSortCondition" in sortState) {
        const sortCondition = sortState.getSortCondition();
        props.datasource.setSortOrder(sortCondition ? [sortCondition] : undefined);
    } else {
        props.datasource.setSortOrder(undefined);
    }

    const setPage = useCallback(
        computePage => {
            const newPage = computePage(currentPage);
            if (isInfiniteLoad) {
                props.datasource.setLimit(newPage * props.pageSize);
            } else {
                props.datasource.setOffset(newPage * props.pageSize);
            }
        },
        [props.datasource, props.pageSize, isInfiniteLoad, currentPage]
    );

    const selection = useSelectionHelper(props.itemSelection, props.datasource, props.onSelectionChange);

    const selectionContextValue = useCreateSelectionContextValue(selection);

    const showHeader = props.filterList.length > 0 || props.sortList.length > 0 || selection?.type === "Multi";

    return (
        <GalleryComponent
            className={props.class}
            desktopItems={props.desktopItems}
            emptyPlaceholderRenderer={useCallback(
                renderWrapper =>
                    props.showEmptyPlaceholder === "custom" ? renderWrapper(props.emptyPlaceholder) : <div />,
                [props.emptyPlaceholder, props.showEmptyPlaceholder]
            )}
            emptyMessageTitle={props.emptyMessageTitle?.value}
            header={useMemo(
                () =>
                    showHeader ? (
                        <FilterContext.Provider
                            value={{
                                filterDispatcher: prev => {
                                    if (prev.filterType) {
                                        const [, filterDispatcher] = customFiltersState[prev.filterType];
                                        filterDispatcher(prev);
                                        setFiltered(true);
                                    }
                                    return prev;
                                },
                                multipleAttributes: filterList,
                                multipleInitialFilters: initialFilters
                            }}
                        >
                            <SortContext.Provider
                                value={{
                                    sortDispatcher: prev => {
                                        setSorted(true);
                                        setSortState(prev);
                                        return prev;
                                    },
                                    attributes: sortList,
                                    initialSort: viewStateSort.current
                                }}
                            >
                                <SelectionContext.Provider value={selectionContextValue}>
                                    {props.filtersPlaceholder}
                                </SelectionContext.Provider>
                            </SortContext.Provider>
                        </FilterContext.Provider>
                    ) : null,
                [
                    FilterContext,
                    SortContext,
                    customFiltersState,
                    filterList,
                    initialFilters,
                    showHeader,
                    props.filtersPlaceholder,
                    sortList
                ]
            )}
            headerTitle={props.filterSectionTitle?.value}
            showHeader={showHeader}
            hasMoreItems={props.datasource.hasMoreItems ?? false}
            items={props.datasource.items ?? []}
            itemRenderer={useCallback(
                (renderWrapper, item) =>
                    renderWrapper(
                        !!selection?.isSelected(item),
                        props.content?.get(item),
                        props.itemClass?.get(item)?.value,
                        (props.onClick || selection) &&
                            (() => {
                                if (props.onClick) {
                                    executeAction(props.onClick?.get(item));
                                }
                                if (selection) {
                                    if (selection.isSelected(item)) {
                                        selection.remove(item);
                                    } else {
                                        selection.add(item);
                                    }
                                }
                            })
                    ),
                [props.content, props.itemClass, props.onClick, selection]
            )}
            numberOfItems={props.datasource.totalCount}
            page={currentPage}
            pageSize={props.pageSize}
            paging={props.pagination === "buttons"}
            paginationPosition={props.pagingPosition}
            phoneItems={props.phoneItems}
            setPage={setPage}
            tabletItems={props.tabletItems}
            tabIndex={props.tabIndex}
        />
    );
}
