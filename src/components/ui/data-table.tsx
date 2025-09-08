import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SearchInput } from '@/components/ui/search-input';
import { cn } from '@/lib/utils';

export interface Column<T> {
  key: keyof T | string;
  label: string;
  render?: (value: unknown, item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  searchable?: boolean;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  emptyMessage?: string;
  className?: string;
  containerClassName?: string;
}

function getNestedValue(obj: Record<string, unknown>, path: string) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

export function DataTable<T extends Record<string, unknown>>({ 
  data, 
  columns, 
  searchable = false,
  searchPlaceholder = "Search...",
  searchValue = "",
  onSearchChange,
  emptyMessage = "No data found.",
  className,
  containerClassName
}: DataTableProps<T>) {
  return (
    <div className={cn("space-y-4", containerClassName)}>
      {searchable && onSearchChange && (
        <SearchInput
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={onSearchChange}
        />
      )}
      
      {data.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">{emptyMessage}</p>
        </div>
      ) : (
        <div className="admin-table-container">
          <Table className={cn("admin-table", className)}>
            <TableHeader>
              <TableRow>
                {columns.map((column, index) => (
                  <TableHead key={String(column.key) + index} className={column.className}>
                    {column.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item, index) => (
                <TableRow key={item.id || index}>
                  {columns.map((column, colIndex) => {
                    const value = typeof column.key === 'string' && column.key.includes('.') 
                      ? getNestedValue(item, column.key as string)
                      : item[column.key];
                    
                    return (
                      <TableCell 
                        key={String(column.key) + colIndex} 
                        className={column.className}
                      >
                        {column.render ? column.render(value, item) : value}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}