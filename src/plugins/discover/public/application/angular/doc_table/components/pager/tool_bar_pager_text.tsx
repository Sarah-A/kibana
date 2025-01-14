/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import React from 'react';
import './tool_bar_pager_text.scss';
import { FormattedMessage, I18nProvider } from '@kbn/i18n/react';

interface Props {
  startItem: number;
  endItem: number;
  totalItems: number;
}

export function ToolBarPagerText({ startItem, endItem, totalItems }: Props) {
  return (
    <I18nProvider>
      <div className="kbnDocTable__toolBarText" data-test-subj="toolBarPagerText">
        <FormattedMessage
          id="discover.docTable.pagerControl.pagesCountLabel"
          defaultMessage="{startItem}&ndash;{endItem} of {totalItems}"
          values={{ startItem, endItem, totalItems }}
        />
      </div>
    </I18nProvider>
  );
}
