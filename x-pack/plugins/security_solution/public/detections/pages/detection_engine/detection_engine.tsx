/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { EuiFlexGroup, EuiFlexItem, EuiSpacer, EuiWindowEvent } from '@elastic/eui';
import styled from 'styled-components';
import { noop } from 'lodash/fp';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useIsExperimentalFeatureEnabled } from '../../../common/hooks/use_experimental_features';
import { isTab } from '../../../../../timelines/public';
import { useDeepEqualSelector, useShallowEqualSelector } from '../../../common/hooks/use_selector';
import { SecurityPageName } from '../../../app/types';
import { TimelineId } from '../../../../common/types/timeline';
import { useGlobalTime } from '../../../common/containers/use_global_time';
import { UpdateDateRange } from '../../../common/components/charts/common';
import { FiltersGlobal } from '../../../common/components/filters_global';
import { getRulesUrl } from '../../../common/components/link_to/redirect_to_detection_engine';
import { SiemSearchBar } from '../../../common/components/search_bar';
import { SecuritySolutionPageWrapper } from '../../../common/components/page_wrapper';
import { inputsSelectors } from '../../../common/store/inputs';
import { setAbsoluteRangeDatePicker } from '../../../common/store/inputs/actions';
import { useAlertInfo } from '../../components/alerts_info';
import { AlertsTable } from '../../components/alerts_table';
import { NoApiIntegrationKeyCallOut } from '../../components/callouts/no_api_integration_callout';
import { AlertsHistogramPanel } from '../../components/alerts_kpis/alerts_histogram_panel';
import { useUserData } from '../../components/user_info';
import { OverviewEmpty } from '../../../overview/components/overview_empty';
import { DetectionEngineNoIndex } from './detection_engine_no_index';
import { DetectionEngineHeaderPage } from '../../components/detection_engine_header_page';
import { useListsConfig } from '../../containers/detection_engine/lists/use_lists_config';
import { DetectionEngineUserUnauthenticated } from './detection_engine_user_unauthenticated';
import * as i18n from './translations';
import { LinkButton } from '../../../common/components/links';
import { useFormatUrl } from '../../../common/components/link_to';
import { useGlobalFullScreen } from '../../../common/containers/use_full_screen';
import { Display } from '../../../hosts/pages/display';
import {
  focusUtilityBarAction,
  onTimelineTabKeyPressed,
  resetKeyboardFocus,
  showGlobalFilters,
} from '../../../timelines/components/timeline/helpers';
import { timelineSelectors } from '../../../timelines/store/timeline';
import { timelineDefaults } from '../../../timelines/store/timeline/defaults';
import {
  buildShowBuildingBlockFilter,
  buildShowBuildingBlockFilterRuleRegistry,
  buildThreatMatchFilter,
} from '../../components/alerts_table/default_config';
import { useSourcererScope } from '../../../common/containers/sourcerer';
import { SourcererScopeName } from '../../../common/store/sourcerer/model';
import { NeedAdminForUpdateRulesCallOut } from '../../components/callouts/need_admin_for_update_callout';
import { MissingPrivilegesCallOut } from '../../components/callouts/missing_privileges_callout';
import { useKibana } from '../../../common/lib/kibana';
import { AlertsCountPanel } from '../../components/alerts_kpis/alerts_count_panel';
import { CHART_HEIGHT } from '../../components/alerts_kpis/common/config';

/**
 * Need a 100% height here to account for the graph/analyze tool, which sets no explicit height parameters, but fills the available space.
 */
const StyledFullHeightContainer = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
`;

const DetectionEnginePageComponent = () => {
  const dispatch = useDispatch();
  const containerElement = useRef<HTMLDivElement | null>(null);
  const getTimeline = useMemo(() => timelineSelectors.getTimelineByIdSelector(), []);
  const graphEventId = useShallowEqualSelector(
    (state) => (getTimeline(state, TimelineId.detectionsPage) ?? timelineDefaults).graphEventId
  );
  const getGlobalFiltersQuerySelector = useMemo(
    () => inputsSelectors.globalFiltersQuerySelector(),
    []
  );
  const getGlobalQuerySelector = useMemo(() => inputsSelectors.globalQuerySelector(), []);
  const query = useDeepEqualSelector(getGlobalQuerySelector);
  const filters = useDeepEqualSelector(getGlobalFiltersQuerySelector);
  // TODO: Once we are past experimental phase this code should be removed
  const ruleRegistryEnabled = useIsExperimentalFeatureEnabled('ruleRegistryEnabled');

  const { to, from } = useGlobalTime();
  const { globalFullScreen } = useGlobalFullScreen();
  const [
    {
      loading: userInfoLoading,
      isSignalIndexExists,
      isAuthenticated: isUserAuthenticated,
      hasEncryptionKey,
      signalIndexName,
      hasIndexWrite,
      hasIndexMaintenance,
    },
  ] = useUserData();
  const {
    loading: listsConfigLoading,
    needsConfiguration: needsListsConfiguration,
  } = useListsConfig();
  const [lastAlerts] = useAlertInfo({});
  const { formatUrl } = useFormatUrl(SecurityPageName.rules);
  const [showBuildingBlockAlerts, setShowBuildingBlockAlerts] = useState(false);
  const [showOnlyThreatIndicatorAlerts, setShowOnlyThreatIndicatorAlerts] = useState(false);
  const loading = userInfoLoading || listsConfigLoading;
  const { navigateToUrl } = useKibana().services.application;

  const updateDateRangeCallback = useCallback<UpdateDateRange>(
    ({ x }) => {
      if (!x) {
        return;
      }
      const [min, max] = x;
      dispatch(
        setAbsoluteRangeDatePicker({
          id: 'global',
          from: new Date(min).toISOString(),
          to: new Date(max).toISOString(),
        })
      );
    },
    [dispatch]
  );

  const goToRules = useCallback(
    (ev) => {
      ev.preventDefault();
      navigateToUrl(formatUrl(getRulesUrl()));
    },
    [formatUrl, navigateToUrl]
  );

  const alertsHistogramDefaultFilters = useMemo(
    () => [
      ...filters,
      ...(ruleRegistryEnabled
        ? buildShowBuildingBlockFilterRuleRegistry(showBuildingBlockAlerts) // TODO: Once we are past experimental phase this code should be removed
        : buildShowBuildingBlockFilter(showBuildingBlockAlerts)),
      ...buildThreatMatchFilter(showOnlyThreatIndicatorAlerts),
    ],
    [filters, ruleRegistryEnabled, showBuildingBlockAlerts, showOnlyThreatIndicatorAlerts]
  );

  // AlertsTable manages global filters itself, so not including `filters`
  const alertsTableDefaultFilters = useMemo(
    () => [
      ...(ruleRegistryEnabled
        ? buildShowBuildingBlockFilterRuleRegistry(showBuildingBlockAlerts) // TODO: Once we are past experimental phase this code should be removed
        : buildShowBuildingBlockFilter(showBuildingBlockAlerts)),
      ...buildThreatMatchFilter(showOnlyThreatIndicatorAlerts),
    ],
    [ruleRegistryEnabled, showBuildingBlockAlerts, showOnlyThreatIndicatorAlerts]
  );

  const onShowBuildingBlockAlertsChangedCallback = useCallback(
    (newShowBuildingBlockAlerts: boolean) => {
      setShowBuildingBlockAlerts(newShowBuildingBlockAlerts);
    },
    [setShowBuildingBlockAlerts]
  );

  const onShowOnlyThreatIndicatorAlertsCallback = useCallback(
    (newShowOnlyThreatIndicatorAlerts: boolean) => {
      setShowOnlyThreatIndicatorAlerts(newShowOnlyThreatIndicatorAlerts);
    },
    [setShowOnlyThreatIndicatorAlerts]
  );

  const { indicesExist, indexPattern } = useSourcererScope(SourcererScopeName.detections);

  const onSkipFocusBeforeEventsTable = useCallback(() => {
    focusUtilityBarAction(containerElement.current);
  }, [containerElement]);

  const onSkipFocusAfterEventsTable = useCallback(() => {
    resetKeyboardFocus();
  }, []);

  const onKeyDown = useCallback(
    (keyboardEvent: React.KeyboardEvent) => {
      if (isTab(keyboardEvent)) {
        onTimelineTabKeyPressed({
          containerElement: containerElement.current,
          keyboardEvent,
          onSkipFocusBeforeEventsTable,
          onSkipFocusAfterEventsTable,
        });
      }
    },
    [containerElement, onSkipFocusBeforeEventsTable, onSkipFocusAfterEventsTable]
  );

  if (isUserAuthenticated != null && !isUserAuthenticated && !loading) {
    return (
      <SecuritySolutionPageWrapper>
        <DetectionEngineHeaderPage border title={i18n.PAGE_TITLE} />
        <DetectionEngineUserUnauthenticated />
      </SecuritySolutionPageWrapper>
    );
  }

  if (!loading && (isSignalIndexExists === false || needsListsConfiguration)) {
    return (
      <SecuritySolutionPageWrapper>
        <DetectionEngineHeaderPage border title={i18n.PAGE_TITLE} />
        <DetectionEngineNoIndex
          needsSignalsIndex={isSignalIndexExists === false}
          needsListsIndex={needsListsConfiguration}
        />
      </SecuritySolutionPageWrapper>
    );
  }

  return (
    <>
      {hasEncryptionKey != null && !hasEncryptionKey && <NoApiIntegrationKeyCallOut />}
      <NeedAdminForUpdateRulesCallOut />
      <MissingPrivilegesCallOut />
      {indicesExist ? (
        <StyledFullHeightContainer onKeyDown={onKeyDown} ref={containerElement}>
          <EuiWindowEvent event="resize" handler={noop} />
          <FiltersGlobal show={showGlobalFilters({ globalFullScreen, graphEventId })}>
            <SiemSearchBar id="global" indexPattern={indexPattern} />
          </FiltersGlobal>

          <SecuritySolutionPageWrapper noPadding={globalFullScreen}>
            <Display show={!globalFullScreen}>
              <DetectionEngineHeaderPage
                subtitle={
                  lastAlerts != null && (
                    <>
                      {i18n.LAST_ALERT}
                      {': '}
                      {lastAlerts}
                    </>
                  )
                }
                title={i18n.PAGE_TITLE}
              >
                <LinkButton
                  fill
                  onClick={goToRules}
                  href={formatUrl(getRulesUrl())}
                  iconType="gear"
                  data-test-subj="manage-alert-detection-rules"
                >
                  {i18n.BUTTON_MANAGE_RULES}
                </LinkButton>
              </DetectionEngineHeaderPage>
              <EuiFlexGroup wrap>
                <EuiFlexItem grow={2}>
                  <AlertsHistogramPanel
                    chartHeight={CHART_HEIGHT}
                    filters={alertsHistogramDefaultFilters}
                    query={query}
                    showTotalAlertsCount={false}
                    titleSize={'s'}
                    signalIndexName={signalIndexName}
                    updateDateRange={updateDateRangeCallback}
                  />
                </EuiFlexItem>

                <EuiFlexItem grow={1}>
                  <AlertsCountPanel
                    filters={alertsHistogramDefaultFilters}
                    query={query}
                    signalIndexName={signalIndexName}
                  />
                </EuiFlexItem>
              </EuiFlexGroup>

              <EuiSpacer size="l" />
            </Display>

            <AlertsTable
              timelineId={TimelineId.detectionsPage}
              loading={loading}
              hasIndexWrite={hasIndexWrite ?? false}
              hasIndexMaintenance={hasIndexMaintenance ?? false}
              from={from}
              defaultFilters={alertsTableDefaultFilters}
              showBuildingBlockAlerts={showBuildingBlockAlerts}
              onShowBuildingBlockAlertsChanged={onShowBuildingBlockAlertsChangedCallback}
              showOnlyThreatIndicatorAlerts={showOnlyThreatIndicatorAlerts}
              onShowOnlyThreatIndicatorAlertsChanged={onShowOnlyThreatIndicatorAlertsCallback}
              to={to}
            />
          </SecuritySolutionPageWrapper>
        </StyledFullHeightContainer>
      ) : (
        <SecuritySolutionPageWrapper>
          <DetectionEngineHeaderPage border title={i18n.PAGE_TITLE} />
          <OverviewEmpty />
        </SecuritySolutionPageWrapper>
      )}
    </>
  );
};

export const DetectionEnginePage = React.memo(DetectionEnginePageComponent);
