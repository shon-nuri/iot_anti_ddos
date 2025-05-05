// src/components/widgets/WidgetContainer.jsx
import React from 'react';
import DoorWidget   from './DoorWidget';
import LightWidget  from './LightWidget';
import TempWidget   from './TempWidget';
import AlarmWidget  from './AlarmWidget';

/**
 * Карта: тип → компонент
 */
const widgetMap = {
  door  : DoorWidget,
  light : LightWidget,
  temp  : TempWidget,
  alarm : AlarmWidget,
};

export default function WidgetContainer({
  widgets      = [],          // массив виджетов
  onAddWidget,                // handler «»
  onRemoveWidget,             // удалить
  reload        = () => {},   // <- главное: дефолт
}) {
  return (
    <div className="grid xs:grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* текущие виджеты */}
      {widgets.map(w => {
        const Cmp = widgetMap[w.type];
        if (!Cmp) return null;   // неизвестный тип
        
        return (
          <Cmp
            key={w.id}
            widget={w}
            reload={reload}         // пробрасываем вниз
            remove={() => onRemoveWidget(w.id)}
          />
        );
      })}

      {/* «добавить» */}
       <div className="flex gap-3 mt-4">
   {Object.keys(widgetMap).map(t => (
     <button
       key={t}
       onClick={() => onAddWidget && onAddWidget(t)}
       className="px-3 py-1 bg-zinc-700 rounded
                  text-zinc-300 hover:text-white hover:bg-zinc-600
                  transition-colors text-sm"
     >
       + {t}
     </button>
   ))}
 </div>
    </div>
  );
}
