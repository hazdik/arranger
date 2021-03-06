import React from 'react';
import { noop } from 'lodash';
import State from '../State';
import ColumnsConfigTable from '../Admin/ColumnsConfigTable';
import AddCustomColumn from './AddCustomColumn';

export default ({ state = {}, addColumn, handleChange = noop, ...props }) => {
  const columns = state.columns || [];

  return (
    <State
      initial={{ searchTerm: '' }}
      render={({ searchTerm, update }) => {
        const filteredColumns = columns.filter(x =>
          x.field.includes(searchTerm),
        );
        return (
          <React.Fragment>
            <ColumnsConfigTable
              total={columns.length}
              data={filteredColumns}
              onFilterChange={searchTerm => update({ searchTerm })}
              handleChange={x =>
                handleChange({
                  field: x.row.field,
                  key: x.key,
                  value:
                    typeof x.value === 'undefined' ? !x.row[x.key] : x.value,
                })
              }
            />
            <AddCustomColumn addColumn={addColumn} />
          </React.Fragment>
        );
      }}
    />
  );
};
